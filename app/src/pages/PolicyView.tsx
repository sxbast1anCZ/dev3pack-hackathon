import { useCallback, useEffect, useState } from 'react'
import { web3 } from '@anchor-lang/core'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { loadCatalog, type Catalog } from '../lib/catalog'
import { dateTime, explorerAddressUrl, periodLabel, pesos, shortAddress } from '../lib/format'
import { readPolicy, type PolicySummary } from '../lib/policy'
import { periodState, recentPurchases } from '../lib/policyMath'
import { estimateSavings } from '../lib/savings'

const EMPTY_CATALOG: Catalog = {
  productNameByHash: new Map(),
  productIdByHash: new Map(),
  productNameById: new Map(),
  pharmacyByWallet: new Map(),
  pharmacyNameById: new Map(),
  products: [],
  pharmacies: [],
  prices: [],
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
      <>
        <TopBar />
        <main className="page">
          <p className="error">Este enlace no es válido.</p>
          <p>
            <a href="/">Volver al inicio</a>
          </p>
        </main>
      </>
    )
  }

  if (state.status === 'loading') {
    return (
      <>
        <TopBar />
        <main className="page">
          <p>Cargando la política…</p>
        </main>
      </>
    )
  }

  if (state.status === 'notFound') {
    return (
      <>
        <TopBar />
        <main className="page">
          <p>No encontramos esta política. Revisa el enlace.</p>
        </main>
      </>
    )
  }

  if (state.status === 'error') {
    return (
      <>
        <TopBar />
        <main className="page">
          <p className="error">
            No pudimos leer la política. Revisa tu conexión e inténtalo de nuevo.
          </p>
          <p>
            <button type="button" className="btn" onClick={() => fetchPolicy(false)}>
              Reintentar
            </button>
          </p>
        </main>
      </>
    )
  }

  const data = state.policy
  const nowSeconds = Math.floor(Date.now() / 1000)
  const period = periodState(data.periodStart, data.periodSeconds, data.spentInPeriod, nowSeconds)
  const percent =
    data.periodBudget > 0 ? Math.min(100, (period.spent / data.periodBudget) * 100) : 0
  const purchases = recentPurchases(data.history, data.purchaseCount)
  const savings = estimateSavings({
    purchases: purchases.map((row) => ({
      amount: row.amount,
      productId: catalog.productIdByHash.get(data.allProductSlots[row.productIndex] ?? '') ?? null,
      pharmacyId:
        catalog.pharmacyByWallet.get(data.allPharmacySlots[row.pharmacyIndex] ?? '')?.id ?? null,
    })),
    prices: catalog.prices,
  })

  const pharmacyLabel = (address: string) =>
    catalog.pharmacyByWallet.get(address)?.name ?? `Farmacia ${shortAddress(address)}`

  const productLabel = (hash: string) =>
    catalog.productNameByHash.get(hash) ?? 'Medicamento fuera del catálogo'

  return (
    <>
      <TopBar>
        <span className="pill">
          <Icon name="eye" size={16} />
          Vista de solo lectura · datos leídos de Solana devnet
        </span>
      </TopBar>
      <main className="page">
        <div className="title-row">
          <div className="title-stack">
            <div className="title-line">
              <h1>Política de compras</h1>
              <span className={data.paused ? 'tag tag-warn' : 'tag tag-ok'}>
                {data.paused ? 'En pausa' : 'Activa'}
              </span>
            </div>
            <div className="mono">{data.address}</div>
          </div>
          <p className="muted">Se actualiza cada 10 segundos</p>
        </div>

        <section className="card card-lg" aria-label="Gasto del período">
          <div className="section-head">
            <span className="label">Gastado en este período</span>
            <span className="muted">
              {period.ended
                ? 'El período anterior terminó. El presupuesto completo está disponible'
                : `Se renueva el ${dateTime(period.renewsAt)}`}
            </span>
          </div>
          <div className="title-line">
            <span className="big-number">{pesos(period.spent)}</span>
            <span className="of">de {pesos(data.periodBudget)}</span>
          </div>
          <div
            className="bar"
            role="progressbar"
            aria-label="Presupuesto usado"
            aria-valuemin={0}
            aria-valuemax={data.periodBudget}
            aria-valuenow={period.spent}
          >
            <div className="bar-fill" style={{ width: `${percent}%` }} />
          </div>
        </section>

        {savings.counted > 0 && (
          <section className="card card-lg fam-stat-ok" aria-label="Ahorro estimado">
            <span className="label">Ahorro estimado</span>
            <span className="big-number">{pesos(savings.total)}</span>
            <p className="muted">
              en {savings.counted} {savings.counted === 1 ? 'compra' : 'compras'}, con los precios
              de hoy, contra la siguiente farmacia más barata con stock.
            </p>
          </section>
        )}

        <div className="stat-grid">
          <div className="card">
            <span className="label">Tope por compra</span>
            <span className="stat-value">{pesos(data.perPurchaseCap)}</span>
          </div>
          <div className="card">
            <span className="label">Presupuesto</span>
            <span className="stat-value">
              {pesos(data.periodBudget)} <small>por período de {periodLabel(data.periodSeconds)}</small>
            </span>
          </div>
          <div className="card">
            <span className="label">Fondos disponibles</span>
            <span className="stat-value">{pesos(data.availablePesos)}</span>
          </div>
        </div>

        <div className="split">
          <section className="card split-side">
            <h2>Farmacias permitidas</h2>
            <ul className="list">
              {data.pharmacies.map((address) => (
                <li key={address} className="list-row">
                  <Icon name="store" size={18} />
                  {pharmacyLabel(address)}
                </li>
              ))}
            </ul>
          </section>
          <section className="card split-main">
            <h2>
              Medicamentos permitidos <span className="muted">· {data.productHashes.length}</span>
            </h2>
            <ul className="med-grid">
              {data.productHashes.map((hash) => (
                <li key={hash}>{productLabel(hash)}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card">
          <div className="section-head">
            <h2>Últimas compras</h2>
            <span className="muted">El programa guarda las últimas 10</span>
          </div>
          {purchases.length === 0 ? (
            <p className="muted">Todavía no hay compras</p>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Medicamento</th>
                      <th>Farmacia</th>
                      <th className="num">Monto</th>
                      <th className="num">Ahorro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((row, idx) => {
                      const saved = savings.perPurchase[idx]
                      return (
                        <tr key={`${row.timestamp}-${idx}`}>
                          <td className="muted">{dateTime(row.timestamp)}</td>
                          <td>
                            <strong>
                              {productLabel(data.allProductSlots[row.productIndex] ?? '')}
                            </strong>
                          </td>
                          <td>{pharmacyLabel(data.allPharmacySlots[row.pharmacyIndex] ?? '')}</td>
                          <td className="num">{pesos(row.amount)}</td>
                          <td className="num">
                            {saved !== null ? (
                              <span className="ok-text">{pesos(saved)}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted">—: no había otra farmacia con stock para comparar.</p>
            </>
          )}
        </section>

        <div className="band">
          <p>
            Cada regla de esta página la hace cumplir el programa en la cadena, no nuestro servidor.
            Cualquiera puede comprobarla en el explorador.
          </p>
          <a
            className="ext-link"
            href={explorerAddressUrl(data.address)}
            target="_blank"
            rel="noreferrer"
          >
            Ver la política en el explorador de Solana <Icon name="external" size={18} />
          </a>
        </div>
      </main>
    </>
  )
}
