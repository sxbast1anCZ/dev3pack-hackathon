# Remedio Seguro

> Built for the Dev3pack Global Hackathon, 27 to 29 November 2026.
> **Status: day one.** Nothing below is built yet. This README is filled in as each part works, and
> it never claims something that is not in the code.

## What it is

A voice agent that buys medicines for an older person, inside spending limits that their family
sets on Solana.

The family creates a policy: a budget per period, a cap per purchase, the pharmacies it allows and
the medicines it allows. The older person only talks. The agent compares prices in pharmacy chains,
proposes one, and pays after a spoken yes. A Solana program checks every rule before any payment:
if the AI is fooled or manipulated, it still cannot pay outside the policy.

## How it works

To be written when the first flow runs: the steps, and a diagram.

## Program addresses

| Network | Program | Address |
| --- | --- | --- |
| Devnet | `remedio_seguro` | [`Axg5mp8n16EGYXEmXVZD4XM3YT2jjsypH2Ep5tJKwaEF`](https://explorer.solana.com/address/Axg5mp8n16EGYXEmXVZD4XM3YT2jjsypH2Ep5tJKwaEF?cluster=devnet) |

## Try it

Live demo: not published yet. The app and its functions deploy to Vercel from `dev` (`vercel.json`).

## Run it locally

Needs Node.js 22 or later.

```
npm install
npm run dev        # the web app, at http://localhost:5173
npm test           # tests of the functions in api/
npm run typecheck
npm run build      # the app, into app/dist
```

`npm run dev` serves only the app. To run the app and the functions in `api/` together, use the
Vercel CLI: `npx vercel dev`.

| Directory | What it holds |
| --- | --- |
| `app/` | The web app: Vite, React and TypeScript |
| `api/` | Vercel functions. Files and folders whose name starts with `_` are not published as functions |

## What Solana does here

To be written when the program runs. In short: the limits are enforced by the program, not by our
server.

## Integrations

Filled in only when the integration runs. Each row names the file where it lives.

| Integration | What it does in the product | File |
| --- | --- | --- |
| Firecrawl | Reads the current price and stock of each catalog medicine on three pharmacy sites (Cruz Verde, Ahumada, Salcobrand) | `data/refresh-prices.mjs` |
| Supabase | Stores the catalog and the latest reading of each price. The browser key can read them and cannot write | `data/refresh-prices.mjs` |

## What this project does not do

- **It does not buy a real medicine.** Payment is in devnet SOL, to devnet addresses we control.
- **It cannot prove a price is real.** Prices come from our own reading of pharmacy sites.
- **It does not keep the list of medicines private.** They are stored on-chain as hashes, which is
  obfuscation. The demo uses fictional people.
- **It does not validate prescriptions,** and the agent gives no medical advice.

## What was built during the hackathon

Everything in this repository. There is no earlier code.

## Team

Sebastián, Ruben, Victor and Luciano.

## Working on this repository

Rules for people and coding agents: [`AGENTS.md`](AGENTS.md). Guide to the documents:
[`docs/README.md`](docs/README.md).
