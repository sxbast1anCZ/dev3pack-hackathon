// Values the browser needs. They come from the VITE_ variables of .env.example.
export const config = {
  rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  elevenLabsAgentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || '',
  guestPolicy: import.meta.env.VITE_GUEST_POLICY || '',
}
