export type Route =
  | { name: 'home' }
  | { name: 'view'; policy: string }
  | { name: 'person'; policy: string }
  | { name: 'guest' }
  | { name: 'family' }
  | { name: 'notFound' }

export function parseRoute(pathname: string): Route {
  const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  if (normalized === '/') return { name: 'home' }
  if (normalized === '/invitado') return { name: 'guest' }
  if (normalized === '/familia') return { name: 'family' }

  const segments = normalized.split('/')
  if (segments.length === 3 && segments[0] === '' && segments[2].length > 0) {
    if (segments[1] === 'ver') return { name: 'view', policy: segments[2] }
    if (segments[1] === 'p') return { name: 'person', policy: segments[2] }
  }

  return { name: 'notFound' }
}
