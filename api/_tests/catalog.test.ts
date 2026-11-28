import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchProduct } from '../_lib/catalog.js'
import { CATALOG } from './fixtures.js'

const find = (query: string) => matchProduct(query, CATALOG.products)?.id

test('requests as speech recognition wrote them on the live agent find the medicine', () => {
  // Real transcriptions from the ElevenLabs tool call history.
  assert.equal(find('milosartán de 50'), 'losartan-50mg-30')
  assert.equal(find('milozartán de cincuenta'), 'losartan-50mg-30')
})

test('plain requests still find the medicine', () => {
  assert.equal(find('Necesito mi Losartán de 50'), 'losartan-50mg-30')
  assert.equal(find('losartan'), 'losartan-50mg-30')
  assert.equal(find('amlodipino de 5'), 'amlodipino-5mg-30')
})

test('a brand is found over the generic of the same medicine', () => {
  assert.equal(find('quiero el corodín de 50'), 'corodin-50mg-30')
})

test('a medicine outside the catalog finds nothing', () => {
  assert.equal(find('ibuprofeno'), undefined)
  assert.equal(find(''), undefined)
})
