import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodLabel, periodNow, pesos, shortAddress, shortProductName } from './format.ts'

test('pesos formats Chilean pesos', () => {
  assert.equal(pesos(0), '$0')
  assert.equal(pesos(2599), '$2.599')
  assert.equal(pesos(15000n), '$15.000')
})

test('periodLabel formats hours, days, minutes and seconds', () => {
  assert.equal(periodLabel(3600), '1 hora')
  assert.equal(periodLabel(7200), '2 horas')
  assert.equal(periodLabel(86400), '1 día')
  assert.equal(periodLabel(2592000), '30 días')
  assert.equal(periodLabel(120), '2 minutos')
  assert.equal(periodLabel(45), '45 segundos')
})

test('periodNow returns natural phrasing for standard periods', () => {
  assert.equal(periodNow(3600), 'esta hora')
  assert.equal(periodNow(86400), 'hoy')
  assert.equal(periodNow(604800), 'esta semana')
  assert.equal(periodNow(2592000), 'este mes')
  assert.equal(periodNow(120), 'en este período')
})

test('shortAddress keeps the first 4 and last 4 characters', () => {
  assert.equal(shortAddress('GUjY1234567890abcdefQqJJ'), 'GUjY…QqJJ')
})

test('shortProductName strips dose and lowercases first letter', () => {
  assert.equal(shortProductName('Losartán 50 mg, 30 comprimidos'), 'losartán')
  assert.equal(
    shortProductName('Ácido acetilsalicílico 100 mg, 30 comprimidos'),
    'ácido acetilsalicílico',
  )
  assert.equal(shortProductName('Eutirox 100 microgramos, 50 comprimidos'), 'eutirox')
  assert.equal(shortProductName('Ibuprofeno'), 'ibuprofeno')
})
