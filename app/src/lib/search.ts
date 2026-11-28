export interface PickItem {
  id: string
  label: string
  detail?: string
  searchText: string
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function byLabel(a: PickItem, b: PickItem): number {
  return a.label.localeCompare(b.label, 'es')
}

export function filterItems(
  items: PickItem[],
  query: string,
  exclude: string[],
  limit = 8,
): { shown: PickItem[]; total: number } {
  const excluded = new Set(exclude)
  const available = items.filter((item) => !excluded.has(item.id))
  const q = normalize(query).trim()

  if (!q) {
    const sorted = [...available].sort(byLabel)
    return { shown: sorted.slice(0, limit), total: sorted.length }
  }

  const startsWith: PickItem[] = []
  const contains: PickItem[] = []

  for (const item of available) {
    const normSearch = normalize(item.searchText)
    if (!normSearch.includes(q)) continue
    if (normalize(item.label).startsWith(q) || normSearch.startsWith(q)) {
      startsWith.push(item)
    } else {
      contains.push(item)
    }
  }

  startsWith.sort(byLabel)
  contains.sort(byLabel)
  const ordered = [...startsWith, ...contains]
  return { shown: ordered.slice(0, limit), total: ordered.length }
}

export function highlight(label: string, query: string): { text: string; match: boolean }[] {
  const q = normalize(query).trim()
  if (!q) return [{ text: label, match: false }]

  let normLabel = ''
  const origIdx: number[] = []
  for (let i = 0; i < label.length; i += 1) {
    const normChar = normalize(label[i])
    for (let j = 0; j < normChar.length; j += 1) {
      normLabel += normChar[j]
      origIdx.push(i)
    }
  }

  const pos = normLabel.indexOf(q)
  if (pos === -1) return [{ text: label, match: false }]

  const start = origIdx[pos]
  const end = origIdx[pos + q.length - 1] + 1
  const parts: { text: string; match: boolean }[] = []

  if (start > 0) parts.push({ text: label.slice(0, start), match: false })
  parts.push({ text: label.slice(start, end), match: true })
  if (end < label.length) parts.push({ text: label.slice(end), match: false })

  return parts
}
