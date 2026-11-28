import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterItems, highlight, normalize, type PickItem } from './search.ts'

const ITEMS: PickItem[] = [
  { id: '1', label: 'Losartán 50 mg, 30 comprimidos', searchText: 'Losartán 50 mg losartan' },
  { id: '2', label: 'Atorvastatina 20 mg, 30 comprimidos', searchText: 'Atorvastatina 20 mg' },
  { id: '3', label: 'Cozaar 50 mg', searchText: 'Cozaar 50 mg losartán' },
  { id: '4', label: 'Enalapril 10 mg', searchText: 'Enalapril 10 mg' },
  { id: '5', label: 'Omeprazol 20 mg', searchText: 'Omeprazol 20 mg' },
]

test('normalize strips accents and lowercases', () => {
  assert.equal(normalize('Losartán 50 MG'), 'losartan 50 mg')
})

test('filterItems matches without accents and case-insensitively', () => {
  const res1 = filterItems(ITEMS, 'losartan', [])
  assert.equal(res1.total, 2)
  assert.equal(res1.shown[0].id, '1')
  assert.equal(res1.shown[1].id, '3')

  const res2 = filterItems(ITEMS, 'ATOR', [])
  assert.equal(res2.total, 1)
  assert.equal(res2.shown[0].id, '2')
})

test('filterItems excludes selected ids and respects limit while counting total', () => {
  const res = filterItems(ITEMS, '', ['2'], 2)
  assert.equal(res.total, 4)
  assert.equal(res.shown.length, 2)
  assert.ok(res.shown.every((item) => item.id !== '2'))
})

test('highlight preserves original accents in matched and unmatched chunks', () => {
  assert.deepEqual(highlight('Losartán 50 mg', 'losar'), [
    { text: 'Losar', match: true },
    { text: 'tán 50 mg', match: false },
  ])
  assert.deepEqual(highlight('Losartán 50 mg', 'tan'), [
    { text: 'Losar', match: false },
    { text: 'tán', match: true },
    { text: ' 50 mg', match: false },
  ])
  assert.deepEqual(highlight('Losartán 50 mg', 'xyz'), [
    { text: 'Losartán 50 mg', match: false },
  ])
})
