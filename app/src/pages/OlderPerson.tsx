import { useEffect, useRef, useState, type ReactNode } from 'react'
import { web3 } from '@anchor-lang/core'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { Icon } from '../components/Icon'
import { config } from '../config'
import { loadCatalog, type Catalog } from '../lib/catalog'
import { CONFIRM_TIMEOUT_MS, classifyAnswer, resolveView, type ElderView } from '../lib/elderView'
import { errorSentence } from '../lib/errors'
import { pesos, shortProductName } from '../lib/format'
import {
  parseProposal,
  parsePurchase,
  parseSearch,
  savingsFor,
  type Proposal,
  type Purchase,
  type Search,
} from '../lib/toolResults'

const EMPTY_CATALOG: Catalog = {
  productNameByHash: new Map(),
  productIdByHash: new Map(),
  productNameById: new Map(),
  pharmacyByWallet: new Map(),
  pharmacyNameById: new Map([
    ['cruzverde', 'Cruz Verde'],
    ['ahumada', 'Ahumada'],
    ['salcobrand', 'Salcobrand'],
  ]),
  products: [],
  pharmacies: [],
  prices: [],
}

function isValidAddress(value: string): boolean {
  try {
    new web3.PublicKey(value)
    return true
  } catch {
    return false
  }
}

function Talk({ policy, footer }: { policy: string; footer?: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG)
  const [search, setSearch] = useState<Search | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [saidYes, setSaidYes] = useState(false)
  const [confirmFailed, setConfirmFailed] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const viewRef = useRef<ElderView>('idle')

  useEffect(() => {
    let active = true
    loadCatalog().then((loaded) => {
      if (active) setCatalog(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  const { startSession, endSession, sendUserMessage, status, mode } = useConversation({
    onMessage(props) {
      if (props.source !== 'user') return
      if (viewRef.current !== 'offer') return
      const answer = classifyAnswer(props.message)
      if (answer === 'yes') {
        setSaidYes(true)
      } else if (answer === 'no') {
        setProposal(null)
      }
    },
    onAgentToolResponse(props) {
      if (import.meta.env.DEV) {
        console.log('[tool]', props)
      }
      if ('full_tool_result' in props && typeof props.full_tool_result === 'string') {
        if (props.tool_name === 'search_prices') {
          setSearch(parseSearch(props.full_tool_result))
        } else if (props.tool_name === 'propose_purchase') {
          setProposal(parseProposal(props.full_tool_result))
          setPurchase(null)
          setSaidYes(false)
          setConfirmFailed(false)
        } else if (props.tool_name === 'confirm_purchase') {
          // A 500 or a timeout of the tool arrives as text that is not a purchase. Whether the
          // payment went through is then unknown: the page says so, as the agent does.
          const result = parsePurchase(props.full_tool_result)
          if (result) setPurchase(result)
          else setConfirmFailed(true)
        }
      } else if (props.tool_name === 'confirm_purchase' && props.is_error) {
        setConfirmFailed(true)
      }
    },
    onError(message) {
      console.error('[conversation]', message)
      setProblem('Se cortó la conversación. Toca para hablar de nuevo.')
    },
    onDisconnect(details) {
      // A call that ends during a purchase is handled by resolveView. The next call starts clean
      // (handleStart), so an old offer never comes back.
      if (details.reason === 'error') {
        setProblem('Se cortó la conversación. Toca para hablar de nuevo.')
      }
    },
  })

  const view = resolveView(status, { proposal, purchase, saidYes, confirmFailed })
  viewRef.current = view

  // A yes that never reached the agent (a cut network, a lost message) gets no answer. After a
  // while the page stops showing «Comprando…». A late answer still shows the result.
  useEffect(() => {
    if (view !== 'buying') return
    const timer = window.setTimeout(() => setConfirmFailed(true), CONFIRM_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [view])

  async function handleStart() {
    setSearch(null)
    setProposal(null)
    setPurchase(null)
    setSaidYes(false)
    setConfirmFailed(false)
    setProblem(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem('Necesito permiso para usar el micrófono.')
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setProblem('Necesito permiso para usar el micrófono.')
      return
    }

    if (!config.elevenLabsAgentId) {
      setProblem('Falta configurar el asistente.')
      return
    }

    startSession({
      agentId: config.elevenLabsAgentId,
      connectionType: 'webrtc',
      dynamicVariables: { policy },
    })
  }

  function handleStop() {
    endSession()
    setSearch(null)
    setProposal(null)
    setPurchase(null)
    setSaidYes(false)
    setConfirmFailed(false)
    setProblem(null)
  }

  function onYes() {
    sendUserMessage('Sí')
    setSaidYes(true)
  }

  function onNo() {
    sendUserMessage('No')
    setProposal(null)
  }

  function onAnother() {
    setSearch(null)
    setProposal(null)
    setPurchase(null)
    setSaidYes(false)
    setConfirmFailed(false)
    setProblem(null)
    if (status !== 'connected' && status !== 'connecting') {
      handleStart()
    }
  }

  const pharmacyName = (pharmacyId: string) => catalog.pharmacyNameById.get(pharmacyId) ?? pharmacyId

  const fullProductName = proposal?.ok
    ? (catalog.productNameById.get(proposal.productId) ??
      (search?.productId === proposal.productId ? search.productName : undefined))
    : undefined
  const shortMed = fullProductName ? shortProductName(fullProductName) : ''
  const medicinePhrase = shortMed ? `tu ${shortMed}` : 'tu remedio'

  const savings = savingsFor(search, proposal)

  const blockedReason =
    purchase && !purchase.ok
      ? purchase.reason
      : proposal && !proposal.ok
        ? proposal.reason
        : proposal && proposal.ok && !proposal.withinPolicy
          ? (proposal.policyReason ?? '')
          : ''

  const showTopStop =
    view === 'listening' ||
    view === 'offer' ||
    view === 'buying' ||
    view === 'blocked' ||
    view === 'unconfirmed'

  return (
    <main className="elder">
      <div className="elder-top">
        {showTopStop && (
          <button type="button" className="quiet-btn" onClick={handleStop}>
            Terminar
          </button>
        )}
      </div>

      {view === 'idle' && (
        <>
          <div className="elder-center">
            <button
              type="button"
              className="mic-ring"
              onClick={handleStart}
              aria-label="Toca para hablar"
            >
              <span className="mic">
                <Icon name="mic" size={72} strokeWidth={2} />
              </span>
            </button>
            <p className="elder-q">Toca para hablar</p>
            <p className="elder-sub">Pide tu remedio en voz alta.</p>
            {problem && <p className="elder-sub error">{problem}</p>}
          </div>
          {footer}
        </>
      )}

      {view === 'connecting' && (
        <div className="elder-center">
          <button type="button" className="mic-ring" disabled aria-label="Conectando">
            <span className="mic">
              <Icon name="mic" size={72} strokeWidth={2} />
            </span>
          </button>
          <p className="elder-q">Conectando…</p>
        </div>
      )}

      {view === 'listening' && (
        <div className="elder-center">
          <div className="mic-ring" aria-hidden="true">
            <span className="mic">
              <Icon name="mic" size={72} strokeWidth={2} />
            </span>
          </div>
          <p className="elder-q">¿Qué remedio necesitas?</p>
          <p className="elder-sub">
            {mode === 'speaking' ? 'Te estoy respondiendo…' : 'Dilo en voz alta.'}
          </p>
        </div>
      )}

      {(view === 'offer' || view === 'buying') && proposal?.ok && (
        <>
          <p className="elder-q elder-q-top">¿Compro {medicinePhrase}?</p>
          <section className="offer" aria-label="Propuesta">
            <span className="offer-store">{pharmacyName(proposal.pharmacy)}</span>
            <span className="offer-price">{pesos(proposal.price)}</span>
            {savings && <span className="save">Ahorras {pesos(savings.amount)}</span>}
          </section>
          <div className="spacer" />
          <button type="button" className="yes" onClick={onYes} disabled={view === 'buying'}>
            {view === 'buying' ? 'Comprando…' : 'Sí'}
          </button>
          {view !== 'buying' && (
            <button type="button" className="no" onClick={onNo}>
              No
            </button>
          )}
          {view !== 'buying' && <p className="elder-hint">O dilo en voz alta.</p>}
        </>
      )}

      {view === 'blocked' && (
        <>
          <div className="elder-center">
            <span className="ring-warn">
              <Icon name={blockedReason === 'Paused' ? 'pause' : 'alert'} size={64} />
            </span>
            <p className="elder-q">No se puede comprar.</p>
            <p className="elder-sub">{errorSentence(blockedReason)}</p>
          </div>
          <button type="button" className="yes yes-dark" onClick={onAnother}>
            Pedir otro remedio
          </button>
        </>
      )}

      {view === 'unconfirmed' && (
        <>
          <div className="elder-center">
            <span className="ring-warn">
              <Icon name="alert" size={64} />
            </span>
            <p className="elder-q">No pude confirmar la compra.</p>
            <p className="elder-sub">Tu familia puede revisar si quedó pagada.</p>
          </div>
          <button type="button" className="yes yes-dark" onClick={onAnother}>
            Pedir otro remedio
          </button>
        </>
      )}

      {view === 'done' && purchase?.ok && (
        <>
          <div className="elder-center">
            <span className="ring-ok">
              <Icon name="check" size={96} strokeWidth={2.6} />
            </span>
            <p className="elder-q elder-q-xl">Listo.</p>
            <p className="elder-sub elder-sub-lg">Compraste {medicinePhrase}.</p>
            {savings && <span className="save">Ahorraste {pesos(savings.amount)}</span>}
          </div>
          <button type="button" className="yes yes-dark" onClick={onAnother}>
            Pedir otro remedio
          </button>
          <a className="link-quiet" href={purchase.explorerUrl} target="_blank" rel="noreferrer">
            Ver comprobante
          </a>
        </>
      )}
    </main>
  )
}

export function OlderPerson({ policy, footer }: { policy: string; footer?: ReactNode }) {
  if (!isValidAddress(policy)) {
    return (
      <main className="elder">
        <div className="elder-top" />
        <div className="elder-center">
          <p className="elder-q">Este enlace no es válido.</p>
          <a className="link-quiet" href="/">
            Volver al inicio
          </a>
        </div>
      </main>
    )
  }

  return (
    <ConversationProvider>
      <Talk policy={policy} footer={footer} />
    </ConversationProvider>
  )
}
