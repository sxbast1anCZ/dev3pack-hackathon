# Rules for people and agents

Four developers work on this repository in parallel, each with a coding agent: Sebastián, Ruben,
Victor and Luciano. Sebastián orchestrates: he owns the task cards, reviews and merges. These rules apply to every person and
every agent, whatever tool they use.

**If you are an agent starting here with no context, read `docs/README.md` first.**

## Sources of truth

- What the hackathon asks: `docs/hackathon-requirements.md`.
- What we decided: `docs/decisions.md`. A decision is changed by adding a new entry, never by
  editing an old one.
- What the product is: the approved design in `docs/superpowers/specs/`.
- What the lanes expect from each other: `docs/contracts.md`.
- Which tasks are open: `docs/agent-handoff.md`.

## Rules that never change

1. **Devnet only.** Test SOL, test wallets. No real funds, no mainnet.
2. **The repository is public. Never commit secrets:** no `.env`, no API keys, no wallet or program
   keypair files, no service-role keys. If you find one committed, stop and tell Sebastián: the key
   must be rotated, deleting the file is not enough.
3. **An integration counts only if it runs.** Never write in the README, a pull request or a
   document that the project uses something that is not working in the code. The judging AI opens
   the files.
4. **One main flow.** Do not add features, accounts, instructions, tables or screens that the
   approved design does not list. If you think one is needed, propose it in `docs/decisions.md` and ask.
5. **A judge must complete the main flow from the live link** without help, without real funds and
   without special hardware. Do not break that path.
6. **Keep the README true.** A pull request that changes behaviour, an address or a setup step
   updates `README.md` in the same pull request.
7. **Never push to `main` or `dev`.** One branch and one pull request per task.
8. Everything in the repository is in English: code, comments, documents, commits, branches. The
   user interface is in Spanish (Chile).

## Before you edit

1. Check `git status` and the current branch. Do not overwrite uncommitted work of someone else.
2. Update from `origin/dev` and create your branch from it.
3. Take one task card and say in the team chat which one. Tasks in the same lane touch the same
   files: one person per lane at a time.
4. Edit only the files of your task. If the task needs a change in another lane or in
   `docs/contracts.md`, stop and ask: the contract changes first, in its own small pull request.

## While you work

- Follow the contract. If the program, the agent tools or the database differ from
  `docs/contracts.md`, the contract is right until it is changed on purpose.
- Do not add a dependency without saying so in the pull request, with the reason.
- Do not delete code, tests or documents of another lane to make a check pass.
- No `git reset --hard`, no `git push --force`, no history rewrites on shared branches.
- If a number, an address or a behaviour differs from what a document says, stop and report it. Do
  not work around it.

## Before you open a pull request

1. Read your whole diff. It contains only the files of your task.
2. Run the checks of your lane (listed in `CONTRIBUTING.md`). If one cannot run, say why in the
   pull request.
3. Commits follow Conventional Commits: `type(scope): summary`, imperative, under 72 characters.
4. In the description say what changed, how you checked it, and what you did not do.
5. Wait for the review comment and read it before merging. Sebastián merges.

## Record decisions

Add an entry to `docs/decisions.md` when a task changes scope, a contract, a tool or a track we
target, and when an idea is discussed and rejected or postponed. Keep each entry short: date, what,
why, who agreed.
