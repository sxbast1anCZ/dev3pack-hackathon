import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { config } from '../config'

export function Home() {
  return (
    <>
      <TopBar />
      <main className="page">
        <div className="title-stack">
          <h1>Remedio Seguro</h1>
          <p className="lead">Tu familia pone las reglas. Tú solo hablas.</p>
        </div>

        <div className="grid-2">
          <a className="big-button" href="/invitado">
            <Icon name="mic" size={34} />
            Probar como invitado
          </a>
          <a className="big-button big-button-dark" href="/familia">
            Soy familia
          </a>
        </div>

        <p className="muted">
          En el modo invitado puedes pedir un remedio por voz. La compra es de prueba: no se paga ni
          se envía nada real.
        </p>

        <section className="section" aria-label="Cómo funciona">
          <h2>Cómo funciona</h2>
          <div className="stat-grid">
            <article className="card">
              <span className="step-num">1</span>
              <h3>La familia pone las reglas</h3>
              <p className="muted">
                Define el tope por compra, el presupuesto por período, las farmacias y los remedios
                permitidos.
              </p>
            </article>
            <article className="card">
              <span className="step-num">2</span>
              <h3>La persona mayor solo habla</h3>
              <p className="muted">
                Pide su remedio por voz, sin contraseñas ni aplicaciones complicadas. El asistente
                compara precios y propone una opción.
              </p>
            </article>
            <article className="card">
              <span className="step-num">3</span>
              <h3>El programa cuida cada pago</h3>
              <p className="muted">
                Al confirmar con un «sí», el programa en Solana revisa cada regla antes de pagar. Si
                algo se sale de los límites, lo rechaza.
              </p>
            </article>
          </div>
        </section>

        <div className="band">
          <p>
            Las reglas y las últimas compras quedan en la cadena y cualquiera puede comprobarlas sin
            confiar en nuestro servidor. Este prototipo corre en Solana devnet con compras
            simuladas.
          </p>
          {config.guestPolicy && (
            <a className="ext-link" href={`/ver/${config.guestPolicy}`}>
              Ver los límites de la cuenta de prueba <Icon name="eye" size={18} />
            </a>
          )}
        </div>
      </main>
    </>
  )
}
