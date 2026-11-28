import { Family } from './pages/Family'
import { Guest } from './pages/Guest'
import { Home } from './pages/Home'
import { NotFound } from './pages/NotFound'
import { OlderPerson } from './pages/OlderPerson'
import { PolicyView } from './pages/PolicyView'
import { parseRoute } from './routes'

export function App() {
  const route = parseRoute(window.location.pathname)

  switch (route.name) {
    case 'home':
      return <Home />
    case 'view':
      return <PolicyView policy={route.policy} />
    case 'person':
      return <OlderPerson policy={route.policy} />
    case 'guest':
      return <Guest />
    case 'family':
      return <Family />
    case 'notFound':
      return <NotFound />
  }
}
