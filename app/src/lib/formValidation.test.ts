import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePesos, validateForm, type PolicyForm } from './formValidation.ts'

const VALID_FORM: PolicyForm = {
  capPesos: 15000,
  budgetPesos: 40000,
  periodSeconds: 2592000,
  depositPesos: 50000,
  pharmacyWallets: ['w1'],
  productIds: ['losartan-50mg-30'],
}

test('parsePesos strips non-digits and returns null when empty', () => {
  assert.equal(parsePesos('15.000'), 15000)
  assert.equal(parsePesos('$2.599'), 2599)
  assert.equal(parsePesos(''), null)
  assert.equal(parsePesos('abc'), null)
})

test('validateForm accepts a valid form', () => {
  assert.equal(validateForm(VALID_FORM), null)
})

test('validateForm rejects invalid cap, budget and deposit', () => {
  assert.equal(
    validateForm({ ...VALID_FORM, capPesos: 0 }),
    'El tope por compra tiene que ser mayor que cero.',
  )
  assert.equal(
    validateForm({ ...VALID_FORM, capPesos: 15.5 }),
    'El tope por compra tiene que ser mayor que cero.',
  )
  assert.equal(
    validateForm({ ...VALID_FORM, budgetPesos: 10000 }),
    'El presupuesto tiene que ser al menos igual al tope por compra.',
  )
  assert.equal(validateForm({ ...VALID_FORM, depositPesos: -1 }), 'El depósito no es válido.')
  assert.equal(validateForm({ ...VALID_FORM, depositPesos: 10.5 }), 'El depósito no es válido.')
})

test('validateForm rejects pharmacy and product count limits', () => {
  assert.equal(validateForm({ ...VALID_FORM, pharmacyWallets: [] }), 'Elige al menos una farmacia.')
  assert.equal(
    validateForm({ ...VALID_FORM, pharmacyWallets: ['w1', 'w2', 'w3', 'w4'] }),
    'Se pueden elegir hasta 3 farmacias.',
  )
  assert.equal(validateForm({ ...VALID_FORM, productIds: [] }), 'Elige al menos un medicamento.')
  assert.equal(
    validateForm({
      ...VALID_FORM,
      productIds: Array.from({ length: 11 }, (_, i) => `p${i}`),
    }),
    'Se pueden elegir hasta 10 medicamentos.',
  )
})
