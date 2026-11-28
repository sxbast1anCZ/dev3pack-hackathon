import { useEffect, useState } from 'react'

type ApiState = 'checking' | 'up' | 'down'

// Scaffold page (card W1). It only proves that the app and api/ are published together.
// The real screens arrive with cards W2 to W4.
export function App() {
  const [api, setApi] = useState<ApiState>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { ok?: boolean }) => setApi(body.ok ? 'up' : 'down'))
      .catch(() => setApi('down'))
  }, [])

  const label = { checking: 'Revisando…', up: 'Funcionando', down: 'Sin conexión' }[api]

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <h1>Remedio Seguro</h1>
      <p>Tu familia pone las reglas. Tú solo hablas.</p>
      <p>
        Estado del servidor: <strong>{label}</strong>
      </p>
    </main>
  )
}
