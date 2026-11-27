// Reads the price and stock of every catalog product in each pharmacy chain with Firecrawl,
// and stores the latest reading in Supabase.
//
//   node --env-file=.env data/refresh-prices.mjs            every product
//   node --env-file=.env data/refresh-prices.mjs <id>       one product
//   node data/refresh-prices.mjs --self-test                check parsers and rules, no network
//
// Firecrawl returns the page as markdown; one fixed parser per chain reads it. No model guesses
// which number is the price. A reading that is empty, about another product, or far from the last
// stored price is reported and NOT written: a broken page must never erase a good price.
// Exit code 1 if any reading failed.
//
// Price rule (docs/contracts.md): what any person pays online, without a club or an agreement.
// Stock is what the page shows to a visitor from Chile who has not chosen a commune.

import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const MIN_PRICE = 100
const MAX_PRICE = 500_000
const MAX_JUMP = 0.6 // a price that moves more than 60% from the stored one is suspicious

const pesos = (text) => Number(text.replaceAll('.', ''))
const heading = (md) => md.match(/^# (.+)$/m)
const afterHeading = (md) => md.slice((heading(md)?.index ?? 0) + (heading(md)?.[0].length ?? 0))
const priceLines = (text) => [...text.matchAll(/^\$\s?([\d.]+)\s*$/gm)].map((m) => pesos(m[1]))

// ponytail: three fixed parsers, one per chain. A fourth chain is a fourth entry here.
export const PARSERS = {
  // "$ 2.690 / $ 1.890 / -29%": normal price struck through, then the offer with its badge.
  // With three prices the middle one is the club price (10% off) and the last is the public offer.
  // Without a badge, the first price is the normal one. That the badge offer is public and not a
  // club price is an inference from the page's styling, checked on two products.
  cruzverde(md) {
    const block = afterHeading(md).split(/^\* \* \*$/m)[0]
    const prices = priceLines(block)
    const hasBadge = /^\s*-\d+%\s*$/m.test(block)
    return {
      product_name: heading(md)?.[1],
      price: hasBadge ? prices.at(-1) : prices[0],
      in_stock: /Stock\s*\n\s*Disponible/i.test(md),
    }
  },
  // The current price is the first "$" line after the title; the old price follows, struck through.
  ahumada(md) {
    return {
      product_name: heading(md)?.[1],
      price: priceLines(afterHeading(md))[0],
      in_stock: !/Producto sin stock/i.test(md),
    }
  },
  // "$2.599Precio Farmacia / $2.287Precio Internet": each label follows its number.
  salcobrand(md) {
    const body = afterHeading(md).split(/Detalles del medicamento/i)[0]
    const internet = body.match(/\$([\d.]+)\s*Precio Internet/i)
    const any = body.replace(/Precio por unidad de medida.*$/im, '').match(/\$([\d.]+)/)
    return {
      product_name: heading(md)?.[1],
      price: internet ? pesos(internet[1]) : any ? pesos(any[1]) : undefined,
      in_stock: /Despacho a domicilio\s*\n\s*Disponible/i.test(md),
    }
  },
}

// Cruz Verde renders its page late.
const WAIT_MS = { cruzverde: 8000, ahumada: 3000, salcobrand: 4000 }

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Returns a reason to reject the reading, or null if it is usable. */
export function rejectReason(reading, product, lastPrice) {
  if (!reading || typeof reading !== 'object') return 'empty reading'
  const { product_name, price, in_stock } = reading
  if (!Number.isInteger(price) || price < MIN_PRICE || price > MAX_PRICE) return `price out of range: ${price}`
  if (typeof in_stock !== 'boolean') return 'stock is not a boolean'
  if (typeof product_name !== 'string' || !fold(product_name).includes(fold(product.active_ingredient))) {
    return `page is about another product: "${product_name}"`
  }
  const doseNumber = product.dose.match(/\d+/)?.[0]
  if (doseNumber && !new RegExp(`(^|\\D)${doseNumber}(\\D|$)`).test(product_name)) {
    return `page is about another dose: "${product_name}"`
  }
  if (lastPrice && Math.abs(price - lastPrice) / lastPrice > MAX_JUMP) {
    return `price moved from ${lastPrice} to ${price}: more than ${MAX_JUMP * 100}%`
  }
  return null
}

function selfTest() {
  // Fixtures cut from real pages read on 2026-11-27.
  const cruzverde = '## SEVEN\n# Losartan Potasico 50 mg 30 Comprimidos\n$ 2.690\n$ 1.890\n -29%\n* * *\nRECETA SIMPLE\nEste producto no cuenta con más stock\nDespacho\nStock\nDisponible\n'
  assert.deepEqual(PARSERS.cruzverde(cruzverde), { product_name: 'Losartan Potasico 50 mg 30 Comprimidos', price: 1890, in_stock: true })
  const threePrices = '# Losartan Potasico 100 mg 30 Comprimidos\n$ 4.970\n$ 4.473\n$ 3.230\n -35% \n* * *\n'
  assert.equal(PARSERS.cruzverde(threePrices).price, 3230)
  assert.equal(PARSERS.cruzverde(threePrices).in_stock, false)
  assert.equal(PARSERS.cruzverde('# X 50 mg\n$ 4.970\n$ 4.473\n* * *\n').price, 4970)

  const ahumada = '4. Losartan Potasico 50 mg x 30 Comprimidos Recubiertos\nProducto sin stock\nSeven Pharma Chile Spa$\n60 x Comp.\n# Losartan Potasico 50 mg x 30 Comprimidos Recubiertos\nMedicamentos\n$1.528\n~~Price reduced from\n$1.799\nto\nPrecio normal~~\n'
  assert.deepEqual(PARSERS.ahumada(ahumada), { product_name: 'Losartan Potasico 50 mg x 30 Comprimidos Recubiertos', price: 1528, in_stock: false })
  assert.equal(PARSERS.ahumada(ahumada.replace('Producto sin stock\n', '')).in_stock, true)

  const salcobrand = '## Losartan\n# Losartan (B) 50mg 30 Comprimidos Recubiertos\nPrecio por unidad de medida: $87 por COMPRIMIDOS\n$2.599Precio Farmacia\n$2.287Precio Internet\nDetalles del medicamento:\nDespacho a domicilio\nDisponible\nProducto no disponible\n'
  assert.deepEqual(PARSERS.salcobrand(salcobrand), { product_name: 'Losartan (B) 50mg 30 Comprimidos Recubiertos', price: 2287, in_stock: true })
  assert.equal(PARSERS.salcobrand('# Y 50mg\nPrecio por unidad de medida: $87 por COMPRIMIDOS\n$2.599\nDetalles del medicamento:\n').price, 2599)

  // A page with no price at all yields no price, and the rules below reject it.
  assert.equal(PARSERS.ahumada('# Losartan 50 mg\nno price here').price, undefined)

  const product = { active_ingredient: 'losartan', dose: '50 mg' }
  const ok = { product_name: 'Losartán Potásico 50 mg 30 Comprimidos', price: 1890, in_stock: true }
  assert.equal(rejectReason(ok, product, null), null)
  assert.equal(rejectReason(ok, product, 2000), null)
  assert.match(rejectReason(null, product, null), /empty/)
  assert.match(rejectReason({ ...ok, price: undefined }, product, null), /out of range/)
  assert.match(rejectReason({ ...ok, price: 0 }, product, null), /out of range/)
  assert.match(rejectReason({ ...ok, in_stock: 'yes' }, product, null), /boolean/)
  assert.match(rejectReason({ ...ok, product_name: 'Sensibio H2O 500 ml' }, product, null), /another product/)
  assert.match(rejectReason({ ...ok, product_name: 'Losartan 100 mg' }, product, null), /another dose/)
  assert.match(rejectReason({ ...ok, product_name: 'Losartan 150 mg' }, product, null), /another dose/)
  assert.match(rejectReason(ok, product, 9000), /moved/)
  console.log('self-test passed')
}

function env(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}. Run with: node --env-file=.env ...`)
  return value
}

async function supabase(path, { method = 'GET', body, prefer } = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Supabase ${method} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const upsert = (table, conflict, rows) =>
  supabase(`${table}?on_conflict=${conflict}`, { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal' })

async function readPage(url, pharmacy) {
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('FIRECRAWL_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      waitFor: WAIT_MS[pharmacy],
      maxAge: 0, // always a live read
      timeout: 60000,
      location: { country: 'CL', languages: ['es'] }, // stock and offers depend on the visitor's country
    }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.success) throw new Error(`Firecrawl ${res.status}: ${JSON.stringify(payload)?.slice(0, 300)}`)
  // Drop images and link targets: only the visible text matters to the parsers.
  const md = (payload.data?.markdown ?? '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\]\([^)]*\)/g, ']').replace(/\n{2,}/g, '\n')
  return { reading: PARSERS[pharmacy](md), credits: payload.data?.metadata?.creditsUsed }
}

async function main() {
  const only = process.argv[2]
  const catalog = JSON.parse(await readFile(new URL('./catalog.json', import.meta.url), 'utf8'))
  const products = catalog.products.filter((p) => !only || p.id === only)
  if (products.length === 0) throw new Error(`No product "${only}" in data/catalog.json`)
  for (const p of products) {
    for (const pharmacy of Object.keys(p.sources)) {
      if (!PARSERS[pharmacy]) throw new Error(`No parser for pharmacy "${pharmacy}" (product ${p.id})`)
    }
  }

  // The catalog file is the source of truth: load it before reading prices.
  await upsert('products', 'id', products.map(({ sources, ...row }) => row))
  await upsert(
    'product_sources',
    'product_id,pharmacy',
    products.flatMap((p) => Object.entries(p.sources).map(([pharmacy, url]) => ({ product_id: p.id, pharmacy, url }))),
  )

  const stored = await supabase('prices?select=product_id,pharmacy,price')
  const lastPrice = (id, pharmacy) => stored.find((r) => r.product_id === id && r.pharmacy === pharmacy)?.price ?? null

  const jobs = products.flatMap((p) => Object.entries(p.sources).map(([pharmacy, url]) => ({ product: p, pharmacy, url })))
  const results = await Promise.all(
    jobs.map(async ({ product, pharmacy, url }) => {
      const started = Date.now()
      const seconds = () => ((Date.now() - started) / 1000).toFixed(1)
      try {
        const { reading, credits } = await readPage(url, pharmacy)
        const reason = rejectReason(reading, product, lastPrice(product.id, pharmacy))
        if (reason) return { product: product.id, pharmacy, ok: false, reason, seconds: seconds(), credits }
        await upsert('prices', 'product_id,pharmacy', [
          { product_id: product.id, pharmacy, price: reading.price, in_stock: reading.in_stock, read_at: new Date().toISOString() },
        ])
        return { product: product.id, pharmacy, ok: true, price: reading.price, in_stock: reading.in_stock, name: reading.product_name, seconds: seconds(), credits }
      } catch (error) {
        return { product: product.id, pharmacy, ok: false, reason: error.message, seconds: seconds() }
      }
    }),
  )

  console.table(results)
  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(`ALERT: ${failed.length} of ${results.length} readings were rejected and not stored.`)
    process.exitCode = 1
  }
}

if (process.argv[2] === '--self-test') selfTest()
else await main()
