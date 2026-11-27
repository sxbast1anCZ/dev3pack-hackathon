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
| Devnet | `remedio_seguro` | Not deployed yet |

## Try it

Live demo: not published yet.

## Run it locally

To be written when the project is scaffolded.

## What Solana does here

To be written when the program runs. In short: the limits are enforced by the program, not by our
server.

## Integrations

Filled in only when the integration runs. Each row names the file where it lives.

| Integration | What it does in the product | File |
| --- | --- | --- |
| | | |

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
