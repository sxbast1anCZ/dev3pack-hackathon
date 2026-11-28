import { useEffect, useState } from 'react'
import { web3 } from '@anchor-lang/core'
import { ConversationProvider, useConversation } from '@elevenlabs/react'
import { Icon } from '../components/Icon'
import { Brand } from '../components/TopBar'
import { config } from '../config'
import { loadCatalog, type Catalog } from '../lib/catalog'
import { errorSentence } from '../lib/errors'
import { pesos } from '../lib/format'
import {
  parseProposal,
  parsePurchase,
  type Proposal,
  type Purchase,
} from '../lib/toolResults'

const EMPTY_CATALOG: Catalog = {
  productNameByHash: new Map(),
  productNameById: new Map(),
  pharmacyByWallet: new Map(),
  pharmacyNameById: new Map([
    ['cruzverde', 'Cruz Verde'],
    ['ahumada', 'Ahumada'],
    ['salcobrand', 'Salcobrand'],
  ]),
}

function isValidAddress(value: string): boolean {
  try {
    new web3.PublicKey(value)
    return true
  } catch {
    return false
  }
}

function Talk({ policy }: { policy: string }) {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG)
  const [lastAgentMessage, setLastAgentMessage] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [purchase, setPurchase] = useState<Purchase | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    loadCatalog().then((loaded) => {
      if (active) setCatalog(loaded)
    })
    return () => {
      active = false
    }
  }, [])

  const { startSession, endSession, status, mode } = useConversation({
    onMessage(props) {
      if (props.source === 'ai') {
        setLastAgentMessage(props.message)
      }
    },
    onAgentToolResponse(props) {
      if (import.meta.env.DEV) {
        console.log('[tool]', props)
      }
      if ('full_tool_result' in props && typeof props.full_tool_result === 'string') {
        if (props.tool_name === 'propose_purchase') {
          setProposal(parseProposal(props.full_tool_result))
          setPurchase(null)
        } else if (props.tool_name === 'confirm_purchase') {
          setPurchase(parsePurchase(props.full_tool_result))
        }
      }
    },
    onError(message) {
      console.error('[conversation]', message)
      setProblem('Se cortó la conversación. Toca para hablar de nuevo.')
    },
    onDisconnect() {},
  })

  async function handleStart() {
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
    setProblem(null)
    endSession()
  }

  const productName = (productId: string) => catalog.productNameById.get(productId) ?? productId
  const pharmacyName = (pharmacyId: string) => catalog.pharmacyNameById.get(pharmacyId) ?? pharmacyId

  return (
    <main className="phone">
      <Brand />

      {status === 'connected' && (
        <div className="status">
          {mode === 'listening' ? (
            <>
              <span className="status-dot" />
              Te escucho…
            </>
          ) : (
            <>
              <Icon name="speaking" />
              Hablando…
            </>
          )}
        </div>
      )}

      {lastAgentMessage && (
        <div>
          <p className="said-label">El asistente dijo:</p>
          <p className="said">“{lastAgentMessage}”</p>
        </div>
      )}

      {proposal && !purchase && (
        proposal.ok ? (
          proposal.withinPolicy ? (
            <section className="proposal" aria-label="Propuesta">
              <div className="proposal-top">
                <span className="eyebrow">Propuesta</span>
                <span className="badge">Dentro de los límites</span>
              </div>
              <p className="product-name">{productName(proposal.productId)}</p>
              <p className="where">
                <Icon name="store" />
                {pharmacyName(proposal.pharmacy)}
              </p>
              <p className="price">{pesos(proposal.price)}</p>
              <p className="hint">Di «sí» para comprar o «no» para cancelar.</p>
            </section>
          ) : (
            <section className="proposal proposal-warn" aria-label="Propuesta">
              <div className="proposal-top">
                <span className="eyebrow">Propuesta</span>
                <span className="badge badge-warn">No se puede comprar</span>
              </div>
              <p className="product-name">{productName(proposal.productId)}</p>
              <p className="where">
                <Icon name="store" />
                {pharmacyName(proposal.pharmacy)}
              </p>
              <p className="price price-struck">{pesos(proposal.price)}</p>
              <p className="reason">
                <Icon name={proposal.policyReason === 'Paused' ? 'pause' : 'alert'} size={24} />
                {errorSentence(proposal.policyReason ?? '')}
              </p>
            </section>
          )
        ) : (
          <p className="reason">
            <Icon name="alert" size={24} />
            {errorSentence(proposal.reason)}
          </p>
        )
      )}

      {purchase && (
        purchase.ok ? (
          <>
            <section className="done" aria-label="Resultado">
              <span className="done-check">
                <Icon name="check" size={36} strokeWidth={2.8} />
              </span>
              <p className="done-title">Compra lista</p>
              <p className="done-line">
                {pesos(purchase.price)} en {pharmacyName(purchase.pharmacy)}.
              </p>
              {proposal?.ok && <p className="done-sub">{productName(proposal.productId)}</p>}
            </section>
            <a className="link-row" href={purchase.explorerUrl} target="_blank" rel="noreferrer">
              Ver comprobante <Icon name="external" />
            </a>
          </>
        ) : (
          <p className="reason">
            <Icon name="alert" size={24} />
            {errorSentence(purchase.reason)}
          </p>
        )
      )}

      {problem && <p className="error">{problem}</p>}

      <div className="spacer" />

      {status === 'connected' ? (
        <button type="button" className="big-button big-button-dark" onClick={handleStop}>
          <Icon name="stop" size={34} />
          Terminar
        </button>
      ) : status === 'connecting' ? (
        <button type="button" className="big-button" disabled>
          Conectando…
        </button>
      ) : (
        <button type="button" className="big-button" onClick={handleStart}>
          <Icon name="mic" size={34} />
          Toca para hablar
        </button>
      )}
    </main>
  )
}

export function OlderPerson({ policy }: { policy: string }) {
  if (!isValidAddress(policy)) {
    return (
      <main className="phone">
        <Brand />
        <p className="error">Este enlace no es válido.</p>
        <p>
          <a href="/">Volver al inicio</a>
        </p>
      </main>
    )
  }

  return (
    <ConversationProvider>
      <Talk policy={policy} />
    </ConversationProvider>
  )
}
