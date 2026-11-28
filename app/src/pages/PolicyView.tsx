import { useCallback, useEffect, useState } from 'react'
import { web3 } from '@anchor-lang/core'
import { loadCatalog, type Catalog } from '../lib/catalog'
import { dateTime, explorerAddressUrl, periodLabel, pesos, shortAddress } from '../lib/format'
import { readPolicy, type PolicySummary } from '../lib/policy'
import { periodState, recentPurchases } from '../lib/policyMath'

const EMPTY_CATALOG: Catalog = {
  productNameByHash: new Map(),
  productNameById: new Map(),
  pharmacyByWallet: new Map(),
  pharmacyNameById: new Map(),
}

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error' }
  | { status: 'ready'; policy: PolicySummary }

function isValidAddress(value: string): boolean {
  try {
    new web3.PublicKey(value)
    return true
  } catch {
    return false
  }
}

export function PolicyView({ policy }: { policy: string }) {
  const valid = isValidAddress(policy)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG)

  const fetchPolicy = useCallback(
    async (isBackground: boolean) => {
      if (!isBackground) {
        setState({ status: 'loading' })
      }
      try {
        const result = await readPolicy(policy)
        if (!result) {
          setState({ status: 'notFound' })
        } else {
          setState({ status: 'ready', policy: result })
        }
      } catch {
        if (!isBackground) {
          setState({ status: 'error' })
        }
      }
    },
    [policy],
  )

  useEffect(() => {
    if (!valid) return
    let active = true

    loadCatalog().then((loaded) => {
      if (active) setCatalog(loaded)
    })

    return () => {
      active = false
    }
  }, [valid])

  useEffect(() => {
    if (!valid) return

    fetchPolicy(false)
    const timer = window.setInterval(() => {
      fetchPolicy(true)
    }, 10_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [valid, fetchPolicy])

  if (!valid) {
    return (
      <main>
        <p className="error">Este enlace no es válido.</p>
        <p>
          <a href="/">Volver al inicio</a>
        </p>
      </main>
    )
  }

  if (state.status === 'loading') {
    return (
      <main>
        <p>Cargando la política…</p>
      </main>
    )
  }

  if (state.status === 'notFound') {
    return (
      <main>
        <p>No encontramos esta política. Revisa el enlace.</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main>
        <p className="error">No pudimos leer la política. Revisa tu conexión e inténtalo de nuevo.</p>
        <button type="button" onClick={() => fetchPolicy(false)}>
          Reintentar
        </button>
      </main>
    )
  }

  const data = state.policy
  const nowSeconds = Math.floor(Date.now() / 1000)
  const period = periodState(data.periodStart, data.periodSeconds, data.spentInPeriod, nowSeconds)
  const purchases = recentPurchases(data.history, data.purchaseCount)

  const pharmacyLabel = (address: string) =>
    catalog.pharmacyByWallet.get(address)?.name ?? `Farmacia ${shortAddress(address)}`

  const productLabel = (hash: string) =>
    catalog.productNameByHash.get(hash) ?? 'Medicamento fuera del catálogo'

  return (
    <main>
      <h1>Política de compras</h1>
      <p>
        <span className={data.paused ? 'tag tag-paused' : 'tag tag-active'}>
          {data.paused ? 'En pausa' : 'Activa'}
        </span>
      </p>

      <ul>
        <li>Tope por compra: {pesos(data.perPurchaseCap)}</li>
        <li>
          Presupuesto: {pesos(data.periodBudget)} cada {periodLabel(data.periodSeconds)}
        </li>
        <li>
          <div>
            Gastado en este período: {pesos(period.spent)} de {pesos(data.periodBudget)}
          </div>
          <progress value={period.spent} max={data.periodBudget} />
        </li>
        <li>
          {period.ended
            ? 'El período anterior terminó. El presupuesto completo está disponible.'
            : `Se renueva el ${dateTime(period.renewsAt)}.`}
        </li>
        <li>Fondos disponibles: {pesos(data.availablePesos)}</li>
      </ul>

      <h2>Farmacias permitidas</h2>
      <ul>
        {data.pharmacies.map((address) => (
          <li key={address}>{pharmacyLabel(address)}</li>
        ))}
      </ul>

      <h2>Medicamentos permitidos</h2>
      <ul>
        {data.productHashes.map((hash) => (
          <li key={hash}>{productLabel(hash)}</li>
        ))}
      </ul>

      <h2>Últimas compras</h2>
      {purchases.length === 0 ? (
        <p>Todavía no hay compras.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Medicamento</th>
              <th>Farmacia</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((row, idx) => (
              <tr key={`${row.timestamp}-${idx}`}>
                <td>{dateTime(row.timestamp)}</td>
                <td>{productLabel(data.allProductSlots[row.productIndex] ?? '')}</td>
                <td>{pharmacyLabel(data.allPharmacySlots[row.pharmacyIndex] ?? '')}</td>
                <td>{pesos(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p>
        <a href={explorerAddressUrl(data.address)} target="_blank" rel="noreferrer">
          Ver la política en el explorador de Solana
        </a>
      </p>
    </main>
  )
}
