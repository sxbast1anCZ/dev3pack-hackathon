import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyAnswer, resolveView, type ElderState } from './elderView.ts'
import type { Proposal } from './toolResults.ts'

const offer: Proposal = {
  ok: true,
  productId: 'paracetamol-500mg-16',
  pharmacy: 'ahumada',
  price: 618,
  withinPolicy: true,
  policyReason: null,
}

const empty: ElderState = { proposal: null, purchase: null, saidYes: false, confirmFailed: false }

test('resolveView follows the call before there is a proposal', () => {
  assert.equal(resolveView('disconnected', empty), 'idle')
  assert.equal(resolveView('connecting', empty), 'connecting')
  assert.equal(resolveView('connected', empty), 'listening')
  assert.equal(resolveView('error', empty), 'idle')
})

test('resolveView shows the offer, then buying after a yes', () => {
  assert.equal(resolveView('connected', { ...empty, proposal: offer }), 'offer')
  assert.equal(resolveView('connected', { ...empty, proposal: offer, saidYes: true }), 'buying')
})

test('resolveView does not keep Sí and No on screen once the call is closed', () => {
  assert.equal(resolveView('disconnected', { ...empty, proposal: offer }), 'idle')
  assert.equal(resolveView('error', { ...empty, proposal: offer }), 'idle')
})

test('resolveView never stays on buying once the call is closed', () => {
  assert.equal(resolveView('disconnected', { ...empty, proposal: offer, saidYes: true }), 'unconfirmed')
  assert.equal(resolveView('error', { ...empty, proposal: offer, saidYes: true }), 'unconfirmed')
})

test('resolveView leaves buying when confirm_purchase failed or timed out', () => {
  const state = { ...empty, proposal: offer, saidYes: true, confirmFailed: true }
  assert.equal(resolveView('connected', state), 'unconfirmed')
})

test('resolveView shows a paid purchase even if it arrives after a failure was assumed', () => {
  const state: ElderState = {
    proposal: offer,
    saidYes: true,
    confirmFailed: true,
    purchase: { ok: true, signature: 'sig', explorerUrl: 'https://explorer.solana.com/tx/sig', price: 618, pharmacy: 'ahumada' },
  }
  assert.equal(resolveView('disconnected', state), 'done')
})

test('resolveView blocks a refusal of the program or the policy', () => {
  assert.equal(
    resolveView('connected', { ...empty, proposal: offer, saidYes: true, purchase: { ok: false, reason: 'Paused' } }),
    'blocked',
  )
  assert.equal(resolveView('connected', { ...empty, proposal: { ok: false, reason: 'OUT_OF_STOCK' } }), 'blocked')
  assert.equal(
    resolveView('connected', { ...empty, proposal: { ...offer, withinPolicy: false, policyReason: 'OverPurchaseCap' } }),
    'blocked',
  )
})

test('classifyAnswer accepts the clear yes words of the prompt', () => {
  for (const text of ['Sí', 'si', 'Sí.', 'sí, sí', 'Sí, cómprelo', 'Dale', 'ya', 'Ya po', 'Cómprelo', 'sí po']) {
    assert.equal(classifyAnswer(text), 'yes', text)
  }
})

test('classifyAnswer accepts a clear no', () => {
  for (const text of ['No', 'no.', 'No, gracias', 'no po', 'No, no lo compre']) {
    assert.equal(classifyAnswer(text), 'no', text)
  }
})

test('classifyAnswer does not take a doubt as an answer', () => {
  for (const text of ['no sé', 'No se', 'Bueno, no sé', 'no sé cuánto era', '¿cuánto era?', 'sí, pero ¿cuánto era?', 'sí pero espera', 'bueno', '']) {
    assert.equal(classifyAnswer(text), null, text)
  }
})

test('classifyAnswer does not read a word that only starts like si or no', () => {
  for (const text of ['sin azúcar', 'siempre lo compro ahí', 'nos vemos', 'noche']) {
    assert.equal(classifyAnswer(text), null, text)
  }
})

test('classifyAnswer does not take a yes followed by a no as a yes', () => {
  assert.equal(classifyAnswer('sí, no, mejor no'), null)
})
