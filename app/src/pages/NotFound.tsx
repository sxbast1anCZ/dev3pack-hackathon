import { TopBar } from '../components/TopBar'

export function NotFound() {
  return (
    <>
      <TopBar />
      <main className="page">
        <h1>Página no encontrada</h1>
        <p>
          <a href="/">Volver al inicio</a>
        </p>
      </main>
    </>
  )
}
