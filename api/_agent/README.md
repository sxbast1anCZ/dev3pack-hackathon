# The voice agent (ElevenLabs)

The ElevenLabs agent and its webhook tools, as configuration. ElevenLabs calls the functions in
`api/tools/` from the internet; the contract of each tool is in `docs/contracts.md`, section 2.

| File | What it is |
| --- | --- |
| `agent.json` | The published agent's id, and its name, language, model, voice, first message, prompt and tools |
| `prompt.md` | The system prompt |
| `tools/*.json` | One webhook tool each, in the shape of the ElevenLabs `tool_config` object |

Placeholders in the tool files:

- `<DEPLOYMENT_HOST>`: the Vercel host of the deployment the agent talks to.
- `<SECRET_ID_OF_AGENT_TOOL_SECRET>`: the id ElevenLabs gives when the value of `AGENT_TOOL_SECRET`
  is stored as a workspace secret. The value itself is never written in this repository.

## Create or update the agent

The agent is published as `agent_2601m8fzhxyvfhqtp07wg45hsgkr` (the web app's `VITE_ELEVENLABS_AGENT_ID`). Its
tools are attached once the API has a public URL.


1. Store `AGENT_TOOL_SECRET` as an ElevenLabs secret (dashboard: Agents, Secrets; or the API
   `POST /v1/convai/secrets`). Note its `secret_id`.
2. Create each tool from its file, with the placeholders filled in (dashboard: Agents, Tools; or
   `POST /v1/convai/tools` with `{ "tool_config": <file> }`).
3. Create the agent with the values of `agent.json` and the text of `prompt.md`, and attach the
   tools.
4. Set the dynamic variable `policy` when a conversation starts. The web page does it
   (`docs/contracts.md`, section 4). For a test in the dashboard, set a placeholder value.

## What to check by hand (card A1)

- The agent answers in Spanish and calls `search_prices` when asked for a medicine.
- A call without the secret is refused: `api/_tests/agent-tool.test.ts` covers it in code.
- How many credits one minute of conversation costs. Write it in the pull request.
