import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AnchorError, web3 } from '@anchor-lang/core'
import { Icon } from '../components/Icon'
import { MultiPicker } from '../components/MultiPicker'
import { TopBar } from '../components/TopBar'
import { config } from '../config'
import { loadCatalog, sha256Bytes, type Catalog } from '../lib/catalog'
import { errorSentence } from '../lib/errors'
import {
  POLICY_RENT_TEXT,
  closePolicy,
  createPolicy,
  familyProgram,
  listFamilyPolicies,
  setPaused,
} from '../lib/familyTx'
import { dateTime, periodLabel, periodNow, pesos, shortAddress } from '../lib/format'
import { parsePesos, validateForm } from '../lib/formValidation'
import {
  initials,
  personTitle,
  readPeople,
  removePerson,
  savePerson,
  type Person,
} from '../lib/people'
import { getPhantom, type PhantomProvider } from '../lib/phantom'
import { readPolicy, type PolicySummary } from '../lib/policy'
import { periodState, recentPurchases } from '../lib/policyMath'
import { estimateSavings } from '../lib/savings'
import type { PickItem } from '../lib/search'

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

const PERIOD_OPTIONS = [
  { seconds: 3600, label: '1 hora' },
  { seconds: 86400, label: '1 día' },
  { seconds: 604800, label: '1 semana' },
  { seconds: 2592000, label: '30 días' },
]

function safeReadPeople(): Record<string, Person> {
  try {
    return readPeople(window.localStorage)
  } catch {
    return {}
  }
}

function safeSavePerson(policy: string, person: Person): void {
  try {
    savePerson(window.localStorage, policy, person)
  } catch {
    // Ignore storage failures in private browsing mode.
  }
}

function safeRemovePerson(policy: string): void {
  try {
    removePerson(window.localStorage, policy)
  } catch {
    // Ignore storage failures in private browsing mode.
  }
}

function txErrorMessage(err: unknown): string {
  if (err instanceof AnchorError) {
    return errorSentence(err.error.errorCode.code)
  }
  const code = (err as { code?: unknown })?.code
  if (code === 4001 || (err instanceof Error && err.message.includes('User rejected'))) {
    return 'Cancelaste la operación.'
  }
  console.error(err)
  return 'No se pudo completar. Inténtalo de nuevo.'
}

function formatSolFromPesos(amountPesos: number): string {
  const sol = amountPesos / 1_000_000
  return sol.toLocaleString('es-CL', { maximumFractionDigits: 6 })
}

function policySavingsFor(policy: PolicySummary, catalog: Catalog) {
  const purchases = recentPurchases(policy.history, policy.purchaseCount)
  return estimateSavings({
    purchases: purchases.map((row) => ({
      amount: row.amount,
      productId: catalog.productIdByHash.get(policy.allProductSlots[row.productIndex] ?? '') ?? null,
      pharmacyId:
        catalog.pharmacyByWallet.get(policy.allPharmacySlots[row.pharmacyIndex] ?? '')?.id ?? null,
    })),
    prices: catalog.prices,
  })
}

export function Family() {
  const [phantom] = useState<PhantomProvider | null>(() => getPhantom())
  const [publicKey, setPublicKey] = useState<web3.PublicKey | null>(
    () => phantom?.publicKey ?? null,
  )
  const [connectError, setConnectError] = useState<string | null>(null)

  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG)
  const [agentKey, setAgentKey] = useState<web3.PublicKey | null>(null)
  const [agentReady, setAgentReady] = useState(false)

  const [policies, setPolicies] = useState<PolicySummary[]>([])
  const [selected, setSelected] = useState<string>('new')
  const [people, setPeople] = useState<Record<string, Person>>(() => safeReadPeople())

  const [copiedPolicy, setCopiedPolicy] = useState<string | null>(null)
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRelation, setEditRelation] = useState('')
  const [busyPolicy, setBusyPolicy] = useState<string | null>(null)
  const [cardError, setCardError] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [periodSeconds, setPeriodSeconds] = useState(2592000)
  const [capText, setCapText] = useState('15.000')
  const [budgetText, setBudgetText] = useState('40.000')
  const [depositText, setDepositText] = useState('50.000')
  const [pharmacyWallets, setPharmacyWallets] = useState<string[]>([])
  const [productIds, setProductIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdPolicy, setCreatedPolicy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadCatalog().then((loaded) => {
      if (active) setCatalog(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadAgent() {
      if (!config.guestPolicy) {
        if (active) {
          setAgentKey(null)
          setAgentReady(true)
        }
        return
      }
      try {
        const guest = await readPolicy(config.guestPolicy)
        if (active) {
          setAgentKey(guest ? new web3.PublicKey(guest.agent) : null)
          setAgentReady(true)
        }
      } catch {
        if (active) {
          setAgentKey(null)
          setAgentReady(true)
        }
      }
    }
    loadAgent()
    return () => {
      active = false
    }
  }, [])

  const reloadPolicies = useCallback(
    async (family: web3.PublicKey, preferredSelected?: string): Promise<PolicySummary[]> => {
      try {
        const addresses = await listFamilyPolicies(family)
        const summaries = await Promise.all(addresses.map((addr) => readPolicy(addr)))
        const loaded = summaries.filter((s): s is PolicySummary => s !== null)
        setPolicies(loaded)
        setSelected((current) => {
          if (preferredSelected) return preferredSelected
          if (current !== 'new' && loaded.some((p) => p.address === current)) return current
          return loaded[0]?.address ?? 'new'
        })
        return loaded
      } catch (err) {
        console.error('Failed to list family policies:', err)
        return []
      }
    },
    [],
  )

  useEffect(() => {
    if (!publicKey) {
      setPolicies([])
      setSelected('new')
      return
    }
    reloadPolicies(publicKey)
  }, [publicKey, reloadPolicies])

  async function handleConnect() {
    if (!phantom) return
    setConnectError(null)
    try {
      const res = await phantom.connect()
      setPublicKey(res.publicKey)
    } catch (err) {
      setConnectError(txErrorMessage(err))
    }
  }

  async function handleDisconnect() {
    if (!phantom) return
    setConnectError(null)
    try {
      await phantom.disconnect()
    } catch {
      // Ignore disconnect errors and clear local state.
    }
    setPublicKey(null)
  }

  async function handleCopyLink(address: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${address}`)
      setCopiedPolicy(address)
      window.setTimeout(() => {
        setCopiedPolicy((current) => (current === address ? null : current))
      }, 2000)
    } catch {
      // Clipboard may be unavailable in non-secure contexts.
    }
  }

  function startEditName(address: string) {
    const existing = people[address]
    setEditingPolicy(address)
    setEditName(existing?.name ?? '')
    setEditRelation(existing?.relation ?? '')
  }

  function saveEditName(address: string) {
    safeSavePerson(address, { name: editName, relation: editRelation })
    setPeople(safeReadPeople())
    setEditingPolicy(null)
  }

  async function handleTogglePause(policy: PolicySummary) {
    if (!phantom || !publicKey) return
    setBusyPolicy(policy.address)
    setCardError((prev) => ({ ...prev, [policy.address]: '' }))
    try {
      const program = familyProgram(phantom)
      await setPaused(program, publicKey, new web3.PublicKey(policy.address), !policy.paused)
      await reloadPolicies(publicKey, policy.address)
    } catch (err) {
      setCardError((prev) => ({ ...prev, [policy.address]: txErrorMessage(err) }))
    } finally {
      setBusyPolicy(null)
    }
  }

  async function handleClose(policy: PolicySummary) {
    if (!phantom || !publicKey) return
    const confirmed = window.confirm(
      '¿Cerrar esta política? Se devuelven todos los fondos a tu cuenta y el enlace de la persona mayor deja de funcionar.',
    )
    if (!confirmed) return

    setBusyPolicy(policy.address)
    setCardError((prev) => ({ ...prev, [policy.address]: '' }))
    try {
      const program = familyProgram(phantom)
      await closePolicy(program, publicKey, new web3.PublicKey(policy.address))
      safeRemovePerson(policy.address)
      setPeople(safeReadPeople())
      const remaining = await reloadPolicies(publicKey)
      setSelected(remaining[0]?.address ?? 'new')
    } catch (err) {
      setCardError((prev) => ({ ...prev, [policy.address]: txErrorMessage(err) }))
    } finally {
      setBusyPolicy(null)
    }
  }

  const pharmacyItems: PickItem[] = catalog.pharmacies
    .filter((p): p is { id: string; name: string; wallet: string } => Boolean(p.wallet))
    .map((p) => ({
      id: p.wallet,
      label: p.name,
      searchText: p.name,
    }))

  const productItems: PickItem[] = catalog.products.map((p) => ({
    id: p.id,
    label: p.name,
    detail: `Principio activo: ${p.activeIngredient}${p.isBioequivalent ? ' · bioequivalente' : ''}`,
    searchText: `${p.name} ${p.activeIngredient}`,
  }))

  const capPesos = parsePesos(capText) ?? 0
  const budgetPesos = parsePesos(budgetText) ?? 0
  const depositPesos = parsePesos(depositText) ?? 0

  const noPharmaciesConfigured = pharmacyItems.length === 0
  const missingAgent = agentReady && !agentKey
  const canCreate = !submitting && !noPharmaciesConfigured && Boolean(agentKey)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!phantom || !publicKey || !agentKey) return

    setFormError(null)
    setCreatedPolicy(null)

    const form = {
      capPesos: parsePesos(capText) ?? 0,
      budgetPesos: parsePesos(budgetText) ?? 0,
      periodSeconds,
      depositPesos: parsePesos(depositText) ?? -1,
      pharmacyWallets,
      productIds,
    }

    const validationError = validateForm(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const hashes = await Promise.all(productIds.map((id) => sha256Bytes(id)))
      const program = familyProgram(phantom)
      const newAddress = await createPolicy(program, publicKey, agentKey, form, hashes)

      if (name.trim()) {
        safeSavePerson(newAddress, { name, relation })
        setPeople(safeReadPeople())
      }

      setCreatedPolicy(newAddress)
      setName('')
      setRelation('')
      setPeriodSeconds(2592000)
      setCapText('15.000')
      setBudgetText('40.000')
      setDepositText('50.000')
      setPharmacyWallets([])
      setProductIds([])

      await reloadPolicies(publicKey, newAddress)
    } catch (err) {
      setFormError(txErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  function formatMoneyOnBlur(text: string, setter: (value: string) => void) {
    const parsed = parsePesos(text)
    if (parsed !== null) {
      setter(parsed.toLocaleString('es-CL'))
    }
  }

  const trimmedName = name.trim()
  const pharmacyCountText =
    pharmacyWallets.length === 0
      ? 'en ninguna farmacia todavía'
      : pharmacyWallets.length === 1
        ? 'en 1 farmacia'
        : `en ${pharmacyWallets.length} farmacias`
  const productCountText =
    productIds.length === 0
      ? 'ningún medicamento todavía'
      : productIds.length === 1
        ? '1 medicamento'
        : `${productIds.length} medicamentos`

  const nowSeconds = Math.floor(Date.now() / 1000)
  const savingsByAddress = new Map(
    policies.map((p) => [p.address, policySavingsFor(p, catalog)] as const),
  )
  let totalTodos = 0
  for (const s of savingsByAddress.values()) {
    totalTodos += s.total
  }

  const selectedPolicy =
    selected === 'new' ? null : (policies.find((p) => p.address === selected) ?? null)

  const pharmacyLabel = (address: string) =>
    catalog.pharmacyByWallet.get(address)?.name ?? `Farmacia ${shortAddress(address)}`
  const productShortLabel = (hash: string) => {
    const full = catalog.productNameByHash.get(hash) ?? 'Medicamento fuera del catálogo'
    return full.split(',')[0]
  }

  return (
    <>
      <TopBar>
        {phantom &&
          (publicKey ? (
            <div className="title-line">
              <span className="pill pill-ok">
                Phantom · {shortAddress(publicKey.toBase58())} · devnet
              </span>
              <button type="button" className="btn" onClick={handleDisconnect}>
                Desconectar
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleConnect}>
              Conectar Phantom
            </button>
          ))}
      </TopBar>

      <main className="page">
        {!phantom ? (
          <>
            <div className="title-stack">
              <h1>Familia</h1>
              <p className="lead">
                Pon las reglas una vez. El asistente solo puede comprar dentro de ellas, y el
                programa en la cadena lo revisa en cada pago.
              </p>
            </div>
            <div className="notice">
              <Icon name="info" />
              <span>
                Para crear una política necesitas la extensión Phantom.{' '}
                <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
                  Descárgala aquí
                </a>
                .
              </span>
            </div>
          </>
        ) : !publicKey ? (
          <>
            <div className="title-stack">
              <h1>Familia</h1>
              <p className="lead">
                Pon las reglas una vez. El asistente solo puede comprar dentro de ellas, y el
                programa en la cadena lo revisa en cada pago.
              </p>
            </div>
            <div className="notice">
              <Icon name="info" />
              <span>
                Activa el modo de pruebas en Phantom (Settings → Developer Settings → Testnet Mode)
                y usa Solana Devnet. Necesitas SOL de prueba:{' '}
                <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                  faucet.solana.com
                </a>
                .
              </span>
            </div>
            {connectError && <p className="error">{connectError}</p>}
          </>
        ) : (
          <div className="fam">
            <aside className="fam-list" aria-label="Personas">
              <h1>Familia</h1>
              <div className="fam-total">
                <span>Ahorro estimado entre todos</span>
                <strong>{pesos(totalTodos)}</strong>
              </div>
              <nav aria-label="Elegir persona" className="fam-people">
                {policies.map((p) => {
                  const person = people[p.address]
                  const period = periodState(
                    p.periodStart,
                    p.periodSeconds,
                    p.spentInPeriod,
                    nowSeconds,
                  )
                  const isSelected = selected === p.address
                  return (
                    <button
                      key={p.address}
                      type="button"
                      className="fam-person"
                      aria-current={isSelected ? 'true' : undefined}
                      onClick={() => {
                        setSelected(p.address)
                        setEditingPolicy(null)
                      }}
                    >
                      <span className={p.paused ? 'avatar avatar-warn' : 'avatar'}>
                        {person?.name ? initials(person.name) : <Icon name="cross" filled />}
                      </span>
                      <span className="fam-person-text">
                        <strong>{personTitle(person) ?? 'Sin nombre'}</strong>
                        <span>
                          {pesos(period.spent)} de {pesos(p.periodBudget)}{' '}
                          {periodNow(p.periodSeconds)}
                        </span>
                      </span>
                      <span className={p.paused ? 'fam-state fam-state-warn' : 'fam-state'}>
                        {p.paused ? 'En pausa' : 'Activa'}
                      </span>
                    </button>
                  )
                })}
              </nav>
              <button
                type="button"
                className="btn btn-dark btn-block"
                onClick={() => {
                  setSelected('new')
                  setEditingPolicy(null)
                }}
              >
                <Icon name="plus" />
                Cuidar a otra persona
              </button>
            </aside>

            <section className="fam-detail" aria-label="Detalle">
              {selectedPolicy ? (
                (() => {
                  const p = selectedPolicy
                  const person = people[p.address]
                  const period = periodState(
                    p.periodStart,
                    p.periodSeconds,
                    p.spentInPeriod,
                    nowSeconds,
                  )
                  const policySavings = savingsByAddress.get(p.address) ?? {
                    total: 0,
                    perPurchase: [],
                    counted: 0,
                  }
                  const purchases = recentPurchases(p.history, p.purchaseCount).slice(0, 5)
                  const isBusy = busyPolicy === p.address
                  const renewText = period.ended
                    ? 'Con la próxima compra'
                    : new Date(period.renewsAt * 1000).toLocaleDateString('es-CL', {
                        day: 'numeric',
                        month: 'short',
                      })

                  return (
                    <>
                      <div className="fam-head">
                        <div>
                          <h2>{personTitle(person) ?? 'Sin nombre'}</h2>
                          <div className="title-line">
                            <span className="mono">Política {shortAddress(p.address)}</span>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => startEditName(p.address)}
                            >
                              Cambiar nombre
                            </button>
                          </div>
                        </div>
                        <div className="title-line">
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleCopyLink(p.address)}
                          >
                            {copiedPolicy === p.address ? 'Enlace copiado' : 'Copiar su enlace'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={isBusy}
                            onClick={() => handleTogglePause(p)}
                          >
                            {p.paused ? 'Reanudar' : 'Pausar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={isBusy}
                            onClick={() => handleClose(p)}
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>

                      {editingPolicy === p.address && (
                        <div className="section">
                          <div className="grid-2">
                            <label className="field">
                              <span className="field-label">Nombre</span>
                              <input
                                className="input"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </label>
                            <label className="field">
                              <span className="field-label">
                                Relación <small>(opcional)</small>
                              </span>
                              <input
                                className="input"
                                value={editRelation}
                                onChange={(e) => setEditRelation(e.target.value)}
                              />
                            </label>
                          </div>
                          <div className="btn-row">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => saveEditName(p.address)}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setEditingPolicy(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {cardError[p.address] && <p className="error">{cardError[p.address]}</p>}

                      <div className="fam-stats">
                        <div className="fam-stat">
                          <span>Gastado {periodNow(p.periodSeconds)}</span>
                          <strong>{pesos(period.spent)}</strong>
                          <span>de {pesos(p.periodBudget)}</span>
                        </div>
                        <div className="fam-stat fam-stat-ok">
                          <span>Ahorro estimado</span>
                          <strong>{pesos(policySavings.total)}</strong>
                          <span>
                            {policySavings.counted === 0
                              ? 'todavía sin comparar'
                              : `en ${policySavings.counted} ${policySavings.counted === 1 ? 'compra' : 'compras'}`}
                          </span>
                        </div>
                        <div className="fam-stat">
                          <span>Fondos</span>
                          <strong>{pesos(p.availablePesos)}</strong>
                          <span>disponibles</span>
                        </div>
                        <div className="fam-stat">
                          <span>Se renueva</span>
                          <strong>{renewText}</strong>
                          <span>cada {periodLabel(p.periodSeconds)}</span>
                        </div>
                      </div>

                      <div className="section">
                        <h3>Compras recientes</h3>
                        {purchases.length === 0 ? (
                          <p className="muted">Todavía no hay compras.</p>
                        ) : (
                          <ul className="fam-buys">
                            {purchases.map((row, idx) => {
                              const saved = policySavings.perPurchase[idx] ?? null
                              return (
                                <li key={`${row.timestamp}-${idx}`}>
                                  <div>
                                    <strong>
                                      {productShortLabel(p.allProductSlots[row.productIndex] ?? '')}
                                    </strong>
                                    <div>
                                      <span className="muted">
                                        {pharmacyLabel(p.allPharmacySlots[row.pharmacyIndex] ?? '')}{' '}
                                        · {dateTime(row.timestamp)}
                                      </span>
                                      {saved !== null && (
                                        <span className="ok-text"> · ahorró {pesos(saved)}</span>
                                      )}
                                    </div>
                                  </div>
                                  <span>{pesos(row.amount)}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        <a href={`/ver/${p.address}`}>Ver todas las compras y el detalle</a>
                      </div>

                      <div className="section">
                        <h3>Sus reglas</h3>
                        <p className="muted">
                          Hasta <strong>{pesos(p.perPurchaseCap)}</strong> por compra, solo en estas
                          farmacias y remedios:
                        </p>
                        <ul className="chips">
                          {p.pharmacies.map((addr) => (
                            <li key={addr} className="chip">
                              {pharmacyLabel(addr)}
                            </li>
                          ))}
                          {p.productHashes.map((hash) => (
                            <li key={hash} className="chip chip-neutral">
                              {productShortLabel(hash)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )
                })()
              ) : (
                <>
                  <h2>Cuidar a otra persona</h2>

                  <form className="form-card" onSubmit={handleSubmit}>
                    <div className="step">
                      <span className="step-num">1</span>
                      <div className="step-body">
                        <div className="step-head">
                          <h3>¿Para quién es?</h3>
                          <p>
                            Así reconoces la política. La persona no necesita cuenta ni contraseña:
                            usa un enlace.
                          </p>
                        </div>
                        <div className="grid-2">
                          <label className="field">
                            <span className="field-label">Nombre</span>
                            <input
                              className="input"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                            />
                          </label>
                          <label className="field">
                            <span className="field-label">
                              Relación <small>(opcional)</small>
                            </span>
                            <input
                              className="input"
                              value={relation}
                              onChange={(e) => setRelation(e.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="step">
                      <span className="step-num">2</span>
                      <div className="step-body">
                        <div className="step-head">
                          <h3>Límites de gasto</h3>
                          <p>El programa rechaza cualquier compra que los pase.</p>
                        </div>

                        <fieldset>
                          <legend>Cada cuánto se renueva el presupuesto</legend>
                          <div className="segmented">
                            {PERIOD_OPTIONS.map((opt) => (
                              <label key={opt.seconds}>
                                <input
                                  type="radio"
                                  name="period"
                                  className="visually-hidden"
                                  checked={periodSeconds === opt.seconds}
                                  onChange={() => setPeriodSeconds(opt.seconds)}
                                />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div className="grid-3">
                          <label className="field">
                            <span className="field-label">Tope por compra</span>
                            <span className="money">
                              <span>$</span>
                              <input
                                inputMode="numeric"
                                value={capText}
                                onChange={(e) => setCapText(e.target.value)}
                                onBlur={() => formatMoneyOnBlur(capText, setCapText)}
                              />
                            </span>
                            <span className="field-help">Máximo en una sola compra</span>
                          </label>

                          <label className="field">
                            <span className="field-label">Presupuesto</span>
                            <span className="money">
                              <span>$</span>
                              <input
                                inputMode="numeric"
                                value={budgetText}
                                onChange={(e) => setBudgetText(e.target.value)}
                                onBlur={() => formatMoneyOnBlur(budgetText, setBudgetText)}
                              />
                            </span>
                            <span className="field-help">
                              Máximo cada {periodLabel(periodSeconds)}
                            </span>
                          </label>

                          <label className="field">
                            <span className="field-label">Depósito inicial</span>
                            <span className="money">
                              <span>$</span>
                              <input
                                inputMode="numeric"
                                value={depositText}
                                onChange={(e) => setDepositText(e.target.value)}
                                onBlur={() => formatMoneyOnBlur(depositText, setDepositText)}
                              />
                            </span>
                            <span className="field-help">
                              Son {formatSolFromPesos(depositPesos)} SOL de prueba
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="step">
                      <span className="step-num">3</span>
                      <div className="step-body">
                        <div className="step-head">
                          <h3>Farmacias</h3>
                          <span className="count">{pharmacyWallets.length} de 3 máximo</span>
                        </div>
                        {noPharmaciesConfigured ? (
                          <p className="error">
                            Las farmacias todavía no tienen cuenta de pago configurada.
                          </p>
                        ) : (
                          <MultiPicker
                            label="Farmacias"
                            chipsLabel="Farmacias elegidas"
                            placeholder="Busca una farmacia"
                            fullText="Llegaste al máximo. Quita una para elegir otra."
                            items={pharmacyItems}
                            selected={pharmacyWallets}
                            max={3}
                            onChange={setPharmacyWallets}
                          />
                        )}
                      </div>
                    </div>

                    <div className="step">
                      <span className="step-num">4</span>
                      <div className="step-body">
                        <div className="step-head">
                          <h3>Medicamentos</h3>
                          <span className="count">{productIds.length} de 10 máximo</span>
                        </div>
                        <MultiPicker
                          label="Medicamentos"
                          chipsLabel="Medicamentos elegidos"
                          placeholder="Busca por nombre o principio activo"
                          fullText="Llegaste al máximo. Quita uno para elegir otro."
                          items={productItems}
                          selected={productIds}
                          max={10}
                          onChange={setProductIds}
                        />
                      </div>
                    </div>

                    {missingAgent && (
                      <div className="step">
                        <p className="error">
                          Falta configurar la cuenta de prueba para conocer al asistente.
                        </p>
                      </div>
                    )}

                    {formError && (
                      <div className="step">
                        <p className="error">{formError}</p>
                      </div>
                    )}

                    {createdPolicy && (
                      <div className="step">
                        <div className="notice">
                          <Icon name="check" />
                          <span>
                            Política creada.{' '}
                            <a href={`/p/${createdPolicy}`}>
                              Abrir la página de la persona mayor
                            </a>{' '}
                            · <a href={`/ver/${createdPolicy}`}>Ver límites y compras</a>
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="form-foot">
                      <p>
                        Phantom te pedirá firmar. Después no se puede editar: solo pausar o cerrar.
                      </p>
                      <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={!canCreate}
                      >
                        {submitting
                          ? 'Creando…'
                          : trimmedName
                            ? `Crear la política de ${trimmedName}`
                            : 'Crear la política'}
                      </button>
                    </div>
                  </form>

                  <aside className="summary" aria-label="Resumen">
                    <span className="eyebrow">Resumen</span>
                    <p className="summary-text">
                      {trimmedName || 'La persona'} podrá comprar hasta{' '}
                      <strong>{pesos(capPesos)}</strong> por vez y{' '}
                      <strong>{pesos(budgetPesos)}</strong> cada {periodLabel(periodSeconds)}, solo{' '}
                      <strong>{pharmacyCountText}</strong> y solo{' '}
                      <strong>{productCountText}</strong>.
                    </p>
                    <dl className="summary-rows">
                      <div>
                        <dt>Depósito</dt>
                        <dd>{pesos(depositPesos)}</dd>
                      </div>
                      <div>
                        <dt>Renta de la cuenta</dt>
                        <dd>{POLICY_RENT_TEXT}</dd>
                      </div>
                      <div>
                        <dt>Al cerrar</dt>
                        <dd>Todo vuelve a ti</dd>
                      </div>
                    </dl>
                    <p className="summary-note">
                      <Icon name="shield" />
                      Aunque alguien engañe al asistente, el programa no deja pagar fuera de estas
                      reglas.
                    </p>
                  </aside>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  )
}
