import { test } from 'node:test'
import assert from 'node:assert/strict'
import { errorSentence } from './errors.ts'

test('errorSentence returns the Spanish sentence for known codes', () => {
  assert.equal(errorSentence('Paused'), 'La familia pausó las compras por ahora.')
  assert.equal(errorSentence('OverPurchaseCap'), 'La compra supera el tope por compra que puso la familia.')
  assert.equal(errorSentence('OUT_OF_STOCK'), 'No hay stock de ese remedio en esa farmacia.')
})

test('errorSentence returns the fallback for an unknown code', () => {
  assert.equal(errorSentence('UNKNOWN_CODE'), 'No se pudo completar. Inténtalo de nuevo.')
})
