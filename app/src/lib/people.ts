export interface Person {
  name: string
  relation: string
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

export const PEOPLE_KEY = 'remedio-seguro:people'

export function readPeople(store: Store): Record<string, Person> {
  const raw = store.getItem(PEOPLE_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, Person> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { name?: unknown }).name === 'string' &&
        typeof (value as { relation?: unknown }).relation === 'string'
      ) {
        result[key] = {
          name: (value as { name: string }).name,
          relation: (value as { relation: string }).relation,
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function savePerson(store: Store, policy: string, person: Person): void {
  const people = readPeople(store)
  const name = person.name.trim()
  const relation = person.relation.trim()
  if (!name) {
    delete people[policy]
  } else {
    people[policy] = { name, relation }
  }
  store.setItem(PEOPLE_KEY, JSON.stringify(people))
}

export function removePerson(store: Store, policy: string): void {
  const people = readPeople(store)
  delete people[policy]
  store.setItem(PEOPLE_KEY, JSON.stringify(people))
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

export function personTitle(p: Person | undefined): string | null {
  if (!p) return null
  const name = p.name.trim()
  if (!name) return null
  const relation = p.relation.trim()
  return relation ? `${name} · ${relation}` : name
}
