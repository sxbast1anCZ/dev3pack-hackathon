import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { config } from '../config'
import { OlderPerson } from './OlderPerson'

export function Guest() {
  if (!config.guestPolicy) {
    return (
      <>
        <TopBar />
        <main className="page">
          <p>El modo invitado todavía no está configurado.</p>
          <p>
            <a href="/">Volver al inicio</a>
          </p>
        </main>
      </>
    )
  }

  return (
    <OlderPerson
      policy={config.guestPolicy}
      footer={
        <a className="link-row" href={`/ver/${config.guestPolicy}`}>
          Ver los límites y las compras de esta cuenta de prueba <Icon name="external" />
        </a>
      }
    />
  )
}
