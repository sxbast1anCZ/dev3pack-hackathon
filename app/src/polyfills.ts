import { Buffer } from 'buffer'

// Anchor encodes instructions with Node's Buffer, which browsers do not have.
const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
g.Buffer ??= Buffer
