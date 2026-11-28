import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute } from './routes.ts'

test('parseRoute matches home', () => {
  assert.deepEqual(parseRoute('/'), { name: 'home' })
})

test('parseRoute matches policy view', () => {
  assert.deepEqual(parseRoute('/ver/4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG'), {
    name: 'view',
    policy: '4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG',
  })
})

test('parseRoute strips trailing slash on policy view', () => {
  assert.deepEqual(parseRoute('/ver/4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG/'), {
    name: 'view',
    policy: '4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG',
  })
})

test('parseRoute matches older person page', () => {
  assert.deepEqual(parseRoute('/p/4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG'), {
    name: 'person',
    policy: '4QLw8on5gdaQeVoNLHShS4GNneEtpR28F1wrPnSY17AG',
  })
})

test('parseRoute matches guest mode', () => {
  assert.deepEqual(parseRoute('/invitado'), { name: 'guest' })
})

test('parseRoute matches family screen', () => {
  assert.deepEqual(parseRoute('/familia'), { name: 'family' })
})

test('parseRoute returns notFound for missing policy address', () => {
  assert.deepEqual(parseRoute('/ver/'), { name: 'notFound' })
})

test('parseRoute returns notFound for unknown path', () => {
  assert.deepEqual(parseRoute('/otra'), { name: 'notFound' })
})
