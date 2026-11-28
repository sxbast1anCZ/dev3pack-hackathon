import { createHash, timingSafeEqual } from 'node:crypto'
import { MissingEnvError, requireEnv } from './env.js'

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

// Constant-time comparison of two strings of any length.
function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export type Validator<T> = (body: unknown) => { ok: true; value: T } | { ok: false; error: string }

// Wraps an agent tool (docs/contracts.md, section 2, "Rules for every call"):
// - the x-agent-secret header must equal AGENT_TOOL_SECRET, otherwise 401;
// - a body that is not JSON, or does not match the tool's shape, is a 400;
// - a business refusal is a 200 with "ok": false, returned by the handler itself;
// - an unexpected error is a 500 with a generic message, so no internal detail reaches the voice.
export function agentTool<T>(validate: Validator<T>, handler: (body: T) => Promise<unknown>) {
  return async (request: Request): Promise<Response> => {
    let expected: string
    try {
      expected = requireEnv('AGENT_TOOL_SECRET')
    } catch (err) {
      if (err instanceof MissingEnvError) {
        console.error(err.message)
        return json({ error: 'server_misconfigured' }, 500)
      }
      throw err
    }

    const given = request.headers.get('x-agent-secret')
    if (!given || !sameSecret(given, expected)) return json({ error: 'unauthorized' }, 401)

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return json({ error: 'body_is_not_json' }, 400)
    }

    const parsed = validate(raw)
    if (!parsed.ok) return json({ error: 'malformed_body', detail: parsed.error }, 400)

    try {
      return json(await handler(parsed.value))
    } catch (err) {
      console.error(err)
      return json({ error: 'internal_error' }, 500)
    }
  }
}

// Small helpers for hand-written validators. No schema library is needed for three tools.
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
