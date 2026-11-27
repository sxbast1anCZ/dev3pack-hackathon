# Contributing

The rules for people and agents are in `AGENTS.md`. This file is the mechanics.

## Branches

| Branch | What it is | Who writes to it |
| --- | --- | --- |
| `main` | Always demoable. The live demo is published from it | Sebastián, by merging `dev` at each milestone |
| `dev` | Integration. Every task lands here first | Pull requests only |
| `feat/<lane>-<task>`, `fix/<lane>-<task>`, `docs/<task>` | One task | The developer who took the task |

Lanes: `program`, `agent`, `web`, `data`. Example: `feat/program-register-item`.

## Flow of one task

1. `git switch dev && git pull`, then `git switch -c feat/<lane>-<task>`.
2. Work in small commits. One logical change per commit.
3. Open a pull request to `dev` when one sub-step works, not when the lane is finished. Small and
   frequent.
4. Before opening: `git pull --rebase origin dev`, then run the checks of your lane.
5. Wait for the review comment and read it. Sebastián merges with squash and deletes the branch.
6. Do not stack pull requests. If you must, rebase the second on `dev` after the first merges, and
   never delete a branch whose pull request is still open.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`.

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`, `style`, `revert`.
- Scope is the lane or the area: `feat(program): add register_item instruction`.
- Imperative mood, under 72 characters, in English.

CI rejects a pull request with a commit that does not follow the format.

## Checks per lane

The commands are added here when each lane is scaffolded. Until then, the rule is: build it, run
its tests, and try the main flow by hand.

| Lane | Checks |
| --- | --- |
| `program` | To be added with the scaffold |
| `agent` | To be added with the scaffold |
| `web` | To be added with the scaffold |
| `data` | To be added with the scaffold |

## Shared files

`README.md`, `AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.env.example`, `docs/contracts.md` and
`docs/decisions.md` change in small pull requests of their own. In `docs/decisions.md` add entries
at the end.

## Never commit

`.env`, API keys, wallet or program keypair files, service-role keys, `node_modules`, build output.
CI scans every push for keypair files and private keys.
