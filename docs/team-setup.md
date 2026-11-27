# Team setup

What each developer needs before taking a task. Tool versions are pinned here when the lanes are
scaffolded; until then this file lists what does not depend on the stack.

## Accounts

- GitHub, with access to this repository.
- The hackathon dashboard, to claim perks (Perks tab): ElevenLabs credits, v0 credits and others.
  Claim with the email registered in the hackathon.

## A devnet wallet, separate from any personal wallet

1. Install Phantom. In Settings, Developer Settings, turn on Testnet Mode and choose Solana Devnet.
2. If you already use Phantom with real funds, create a separate account for the hackathon.
3. Ask for test SOL at `faucet.solana.com`, signed in with GitHub (the limit is higher than without
   it). **Do it now:** during the hackathon everyone asks at once and the faucet saturates.
4. Never put a wallet file or a seed phrase in the repository or in the team chat.

Everything runs on devnet. No real funds at any point.

## Rust, the Solana CLI and Anchor (lane `program`)

This is the slowest step the first time. Start it before anything else. Source: the Anchor
installation guide, `anchor-lang.com/docs/installation`, read on 2026-11-27.

On Mac and Linux, one command installs Rust, the Solana CLI, the Anchor CLI, Node.js and Yarn:

```
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

On Windows, the guide requires WSL: install it first and run that command in the Ubuntu terminal.

Restart the terminal, then check:

```
rustc --version
solana --version
anchor --version
```

The guide showed Anchor CLI 1.2.2 on that date. Write the versions you got in your first pull
request: the TypeScript client in `api/` and `app/` must use the same Anchor version as the CLI.

If the one command fails, the same guide has the steps one by one. If nothing compiles by 21:00 on
Friday, build and deploy from Solana Playground (`beta.solpg.io`) and keep the source in `program/`.

Point the CLI at devnet: `solana config set --url devnet`.

## Secrets

- Copy `.env.example` to `.env`. The values are shared in the team chat, never in git.
- Before every push: `bash scripts/check-secrets.sh`. On Windows run it from Git Bash: in
  PowerShell, `bash` may resolve to WSL and fail.
- The repository is public. A key that was pushed is compromised even if the commit is deleted:
  tell Sebastián so it is rotated.

## Your agent

Any coding agent works. It must read `AGENTS.md`; Claude Code does it through `CLAUDE.md`. If your
tool reads another file, point it to `AGENTS.md`.

For Claude Code, the plugins the orchestrator uses:

```
/plugin marketplace add forrestchang/andrej-karpathy-skills
/plugin marketplace add DietrichGebert/ponytail
/plugin install superpowers@claude-plugins-official
/plugin install andrej-karpathy-skills@karpathy-skills
/plugin install ponytail@ponytail
/plugin install frontend-design@claude-plugins-official
```

## Reference material from the organizers

Listed in the Resources tab of the dashboard. Not installed in this repository yet: each one is
read before it is added.

| Resource | Use |
| --- | --- |
| `github.com/solana-foundation/solana-dev-skill` | Official Solana developer skill for agents |
| `solana.com/skills` | Official catalog of Solana agent skills |
| `github.com/solana-foundation/create-solana-dapp` | Scaffold a Solana app in one command |
| `solana.com/developers/templates` | Official starter templates |
| `docs.phantom.com/phantom-connect` | Wallet integration recommended by the organizers |
| `faucet.solana.com` | Test SOL |
| `beta.solpg.io` | Solana Playground: build and deploy a program from the browser, as a fallback |
| `github.com/solana-mobile/solana-mobile-skills` | Agent skills for Solana Mobile (stretch goal) |
| `solenegpt.bonfires.ai` | The hackathon's AI mentor |

## Help

- The Mentors tab of the dashboard.
- The hackathon Telegram group, linked from the dashboard.
