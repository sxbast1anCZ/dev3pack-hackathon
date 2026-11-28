import { normalize } from './search'
import type { Proposal, Purchase } from './toolResults'

// What the older person's page shows, derived from the conversation and the tool results.
// Kept apart from the page so each case has a test (elderView.test.ts).

export type ElderView =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'offer'
  | 'buying'
  | 'blocked'
  | 'unconfirmed'
  | 'done'

// Values of ConversationStatus in @elevenlabs/react.
export type CallStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface ElderState {
  proposal: Proposal | null
  purchase: Purchase | null
  // The person said or tapped yes to the proposal on screen.
  saidYes: boolean
  // confirm_purchase failed, its answer could not be read, the call ended while buying, or no
  // answer came in time. Whether the payment went through is unknown.
  confirmFailed: boolean
}

// How long the page waits for confirm_purchase after a yes before it stops showing «Comprando…».
// A devnet payment usually confirms in a few seconds; a yes lost on a cut network never answers.
export const CONFIRM_TIMEOUT_MS = 45_000

export function resolveView(status: CallStatus, state: ElderState): ElderView {
  const { proposal, purchase, saidYes, confirmFailed } = state

  if (purchase?.ok) return 'done'
  if (purchase && !purchase.ok) return 'blocked'
  if (confirmFailed) return 'unconfirmed'
  if (proposal && (!proposal.ok || !proposal.withinPolicy)) return 'blocked'
  if (proposal && proposal.ok && proposal.withinPolicy) {
    if (saidYes) return status === 'connected' ? 'buying' : 'unconfirmed'
    // Sí and No only reach the agent while the call is open.
    return status === 'connected' ? 'offer' : 'idle'
  }
  if (status === 'connecting') return 'connecting'
  if (status === 'connected') return 'listening'
  return 'idle'
}

export type Answer = 'yes' | 'no' | null

// The words that count as a clear yes, as in step 5 of api/_agent/prompt.md: «Sí», «cómprelo»,
// «dale», «ya». Compared without accents.
const YES_WORDS = new Set(['si', 'dale', 'ya', 'comprelo', 'compralo'])

// Reads what the person said on the proposal screen with the same rule as the agent's prompt:
// only a clear yes or a clear no counts. «Bueno, no sé», «¿cuánto era?» or «sí, pero…» are
// neither, so the screen keeps the proposal while the agent asks again.
export function classifyAnswer(text: string): Answer {
  if (text.includes('?')) return null

  const words = normalize(text)
    .replace(/[^a-zñ\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return null

  if (words.includes('pero')) return null
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'no' && words[i + 1] === 'se') return null
  }

  if (words[0] === 'no') return 'no'
  if (YES_WORDS.has(words[0]) && !words.includes('no')) return 'yes'
  return null
}
