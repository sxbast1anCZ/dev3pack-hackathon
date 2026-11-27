// Reads the price and stock of every catalog product in each pharmacy chain with Firecrawl,
// and stores the latest reading in Supabase.
//
//   node --env-file=.env data/refresh-prices.mjs            every product
//   node --env-file=.env data/refresh-prices.mjs <id>       one product
//   node data/refresh-prices.mjs --self-test                check parsers and rules, no network
//
// Other lanes import it: import { refresh } from '../data/refresh-prices.mjs', then refresh('<id>').
// The schedule is .github/workflows/refresh-prices.yml.
//
// Firecrawl returns the page as markdown; one fixed parser per chain reads it. No model guesses
// which number is the price. A reading that is empty, about another product, or far from the last
// stored price is reported and NOT written: a broken page must never erase a good price.
// Exit code 1 if any reading failed.
//
// Price rule (docs/contracts.md): what any person pays online, without a club or an agreement.
// Stock is what the page shows to a visitor from Chile who has not chosen a commune.

import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import catalog from './catalog.json' with { type: 'json' }

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
  // A page names a product by its active ingredient or, for a brand, by the brand alone.
  const names = [product.active_ingredient, product.brand].filter(Boolean).map(fold)
  if (typeof product_name !== 'string' || !names.some((n) => fold(product_name).includes(n))) {
    return `page is about another product: "${product_name}"`
  }
  // ponytail: the dose and the pack size are checked as bare numbers in the title. A title that
  // swaps them (dose 30, pack 50 for a 50 mg x 30 product) would pass; parse units if that shows up.
  const hasNumber = (n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(product_name)
  const doseNumber = product.dose.match(/\d+/)?.[0]
  if (doseNumber && !hasNumber(doseNumber)) return `page is about another dose: "${product_name}"`
  if (product.quantity && !hasNumber(product.quantity)) return `page is about another pack size: "${product_name}"`
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

  const product = { active_ingredient: 'losartan', dose: '50 mg', quantity: 30 }
  const ok = { product_name: 'Losartán Potásico 50 mg 30 Comprimidos', price: 1890, in_stock: true }
  assert.match(rejectReason({ ...ok, product_name: 'Losartan 50 mg 60 Comprimidos' }, product, null), /another pack size/)
  const brand = { brand: 'corodin', active_ingredient: 'losartan', dose: '50 mg', quantity: 30 }
  assert.equal(rejectReason({ ...ok, product_name: 'Corodin 50 mg x 30 Comprimidos Recubiertos' }, brand, null), null)
  assert.match(rejectReason({ ...ok, product_name: 'Cozaar 50 mg x 30 Comprimidos' }, brand, null), /another product/)
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
  if (!value) throw new Error(`Missing environment variable ${name}. As a command: node --env-file=.env data/refresh-prices.mjs`)
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

// ponytail: fixed batches, not a sliding pool. Firecrawl's free plan allows few concurrent reads.
const CONCURRENCY = 3
async function inBatches(items, size, fn) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
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
    signal: AbortSignal.timeout(90_000), // one page must never hang a whole run
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.success) throw new Error(`Firecrawl ${res.status}: ${JSON.stringify(payload)?.slice(0, 300)}`)
  // Drop images and link targets: only the visible text matters to the parsers.
  const md = (payload.data?.markdown ?? '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\]\([^)]*\)/g, ']').replace(/\n{2,}/g, '\n')
  return { reading: PARSERS[pharmacy](md), credits: payload.data?.metadata?.creditsUsed }
}

/**
 * Reads every catalog product, or only the one with id `only`, and stores each reading that passes
 * the rules. Returns one result per page: { product, pharmacy, ok, price?, in_stock?, reason? }.
 * A page costs one Firecrawl credit and takes 7 to 20 seconds: never call this inside a voice turn
 * for more than one product.
 */
export async function refresh(only) {
  const products = catalog.products.filter((p) => !only || p.id === only)
  if (products.length === 0) throw new Error(`No product "${only}" in data/catalog.json`)
  for (const p of products) {
    for (const pharmacy of Object.keys(p.sources)) {
      if (!PARSERS[pharmacy]) throw new Error(`No parser for pharmacy "${pharmacy}" (product ${p.id})`)
    }
  }

  // The catalog file is the source of truth: load it before reading prices.
  // `sources` and `brand` live only in the catalog file; the table has no such columns.
  await upsert('products', 'id', products.map(({ sources, brand, ...row }) => row))
  await upsert(
    'product_sources',
    'product_id,pharmacy',
    products.flatMap((p) => Object.entries(p.sources).map(([pharmacy, url]) => ({ product_id: p.id, pharmacy, url }))),
  )

  const stored = await supabase('prices?select=product_id,pharmacy,price')
  const lastPrice = (id, pharmacy) => stored.find((r) => r.product_id === id && r.pharmacy === pharmacy)?.price ?? null

  const jobs = products.flatMap((p) => Object.entries(p.sources).map(([pharmacy, url]) => ({ product: p, pharmacy, url })))
  return inBatches(jobs, CONCURRENCY, async ({ product, pharmacy, url }) => {
    const started = Date.now()
    const base = { product: product.id, pharmacy }
    const seconds = () => ((Date.now() - started) / 1000).toFixed(1)
    let failure
    // A page sometimes comes back half rendered, or Firecrawl fails once: try twice, then report.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { reading, credits } = await readPage(url, pharmacy)
        const reason = rejectReason(reading, product, lastPrice(product.id, pharmacy))
        if (!reason) {
          await upsert('prices', 'product_id,pharmacy', [
            { product_id: product.id, pharmacy, price: reading.price, in_stock: reading.in_stock, read_at: new Date().toISOString() },
          ])
          return { ...base, ok: true, price: reading.price, in_stock: reading.in_stock, seconds: seconds(), credits }
        }
        failure = { reason, credits }
        // ponytail: a big move is never accepted automatically. To accept one, delete the stored row.
        if (reason.startsWith('price moved')) break
      } catch (error) {
        failure = { reason: error.message }
      }
    }
    return { ...base, ok: false, seconds: seconds(), ...failure }
  })
}

// Run as a command, not when another lane imports refresh().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--self-test') {
    selfTest()
  } else {
    const results = await refresh(process.argv[2])
    console.table(results.map(({ reason, ...row }) => row))
    const failed = results.filter((r) => !r.ok)
    for (const f of failed) console.error(`REJECTED ${f.product} at ${f.pharmacy}: ${f.reason}`)
    if (failed.length) {
      console.error(`ALERT: ${failed.length} of ${results.length} readings were rejected and not stored.`)
      process.exitCode = 1
    }
  }
}