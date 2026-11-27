// GET /api/health. Proves the functions are published next to the app (card W1).
export function GET(): Response {
  return Response.json({ ok: true, service: 'remedio-seguro' })
}
