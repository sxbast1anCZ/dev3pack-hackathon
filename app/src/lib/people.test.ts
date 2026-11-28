import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PEOPLE_KEY,
  initials,
  personTitle,
  readPeople,
  removePerson,
  savePerson,
} from './people.ts'

function memoryStore(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial))
  return {
    getItem(key: string) {
      return map.get(key) ?? null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

test('readPeople returns empty object when missing or invalid JSON', () => {
  assert.deepEqual(readPeople(memoryStore()), {})
  assert.deepEqual(readPeople(memoryStore({ [PEOPLE_KEY]: '{broken' })), {})
})

test('savePerson saves, updates, and deletes when name is empty', () => {
  const store = memoryStore()
  savePerson(store, 'pol1', { name: 'Rosa', relation: 'mamá' })
  assert.deepEqual(readPeople(store), { pol1: { name: 'Rosa', relation: 'mamá' } })

  savePerson(store, 'pol1', { name: '   ', relation: 'mamá' })
  assert.deepEqual(readPeople(store), {})
})

test('removePerson removes an existing entry', () => {
  const store = memoryStore()
  savePerson(store, 'pol1', { name: 'Rosa', relation: 'mamá' })
  removePerson(store, 'pol1')
  assert.deepEqual(readPeople(store), {})
})

test('initials builds 1 or 2 uppercase letters or ?', () => {
  assert.equal(initials('Rosa'), 'R')
  assert.equal(initials('Rosa Muñoz'), 'RM')
  assert.equal(initials('  ana  maría  soto '), 'AM')
  assert.equal(initials(''), '?')
})

test('personTitle combines name and optional relation', () => {
  assert.equal(personTitle({ name: 'Rosa', relation: 'mamá' }), 'Rosa · mamá')
  assert.equal(personTitle({ name: 'Rosa', relation: '' }), 'Rosa')
  assert.equal(personTitle({ name: '', relation: 'mamá' }), null)
  assert.equal(personTitle(undefined), null)
})
