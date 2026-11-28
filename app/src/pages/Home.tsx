import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { config } from '../config'

export function Home() {
  return (
    <>
      <TopBar>
        <span className="muted">Compras de prueba · nada se cobra</span>
      </TopBar>
      <main className="page">
        <h1 className="hero-title">
          Habla. Nosotros cuidamos <span className="clay">el resto.</span>
        </h1>
        <div className="bento">
          <a className="tile tile-main" href="/invitado">
            <span className="tile-icon">
              <Icon name="mic" size={38} />
            </span>
            <span>
              <span className="tile-title">Probar como invitado</span>
              <span className="tile-sub">Toca aquí y pide tu remedio con tu voz.</span>
            </span>
          </a>
          <a className="tile tile-wide" href="/familia">
            <span>
              <span className="tile-title">Soy familia</span>
              <span className="tile-sub">Cuida a alguien desde aquí</span>
            </span>
            <Icon name="arrow" size={26} />
          </a>
          {config.guestPolicy && (
            <a className="tile" href={`/ver/${config.guestPolicy}`}>
              <span className="tile-title tile-title-sm">Ver la política de prueba</span>
              <span className="tile-sub">Límites y compras →</span>
            </a>
          )}
          <div className="tile tile-stat">
            <span className="tile-number">3</span>
            <span className="tile-sub">
              farmacias comparadas: Cruz Verde, Ahumada y Salcobrand
            </span>
          </div>
        </div>
        <ul className="facts-row">
          <li>
            <strong>$15.000</strong> tope por compra
          </li>
          <li>
            <strong>10</strong> remedios en el catálogo
          </li>
          <li>
            <strong>Cada pago</strong> revisado por un programa en Solana
          </li>
        </ul>
      </main>
    </>
  )
}
