# Submission: milestones and checklist

Deadline: **Sunday 2026-11-29, 04:00 (Chile time)**. The form is in the Project tab of the member
dashboard and can be edited until then. Requirements: `../hackathon-requirements.md`.

## Milestones (Chile time)

The times are a proposal by the agent; Sebastián adjusts them.

| When | What must be true |
| --- | --- |
| Fri 27, end of day | Product design approved. Contracts and task cards written. Every developer has a devnet wallet with test SOL |
| Sat 28, 10:00 | A thin version of the main flow works end to end: the program is on devnet and the web app is live. Shown in the feedback session |
| Sat 28, 16:00 | **Minimal submission saved in the form:** program address, public repository, a first video. From here on we only improve |
| Sat 28, 22:00 | Feature freeze. Only fixes, README and video after this |
| Sun 29, 00:00 | Final video recorded and uploaded |
| Sun 29, 02:00 | Final submission checked link by link |
| Sun 29, 04:00 | The form locks |

`dev` is merged into `main` before the Saturday 10:00 session and before the final submission.

## Before the final submission

### Program

- [ ] Deployed on devnet; the explorer shows it as an executable program account.
- [ ] The address is in `README.md` and in the form.
- [ ] Any instruction that fixes an administrator was called by us before the address was published.
- [ ] The program keypair is not in the repository.

### Repository

- [ ] Public. Opened in a private window to confirm.
- [ ] `bash scripts/check-secrets.sh` passes.
- [ ] `README.md` is complete (list below).

### README, written for the judges and the judging AI

- [ ] What problem it solves and for whom, in the first lines.
- [ ] How it works, step by step, with a diagram of the app.
- [ ] Program addresses on devnet, with explorer links.
- [ ] How to install and run it, and how to try the live demo.
- [ ] For each partner track: what the integration does and the file where it lives.
- [ ] What Solana does here that a database could not.
- [ ] What works and what does not. Nothing claimed that is not in the code.
- [ ] What was built during the hackathon.

### Live demo

- [ ] Published; the link opens in a private window.
- [ ] A person who never saw the app completes the main flow without help and without real funds.
- [ ] It is an app where the user does something, not a landing page.

### Video

- [ ] Under 3 minutes. Checked with the player, not estimated.
- [ ] Shows the product working: what it is, the problem, how it works, and the transaction in the explorer.
- [ ] Public link; opens in a private window.

### Form

- [ ] Project name (up to 50 characters), one-liner (up to 120), description (up to 300 words).
- [ ] Screenshots, logo and banner.
- [ ] Program address, repository link, live demo link, video link.
- [ ] Each partner track marked has its explanation and its file.
- [ ] Team members confirmed.

### If we go for Solana Mobile

- [ ] Native app started from the official template. Not a wrapped web app.
- [ ] Installable APK attached or linked.
- [ ] Connect and sign work through Mobile Wallet Adapter on a clean install.
- [ ] A demo video of the wallet flow on a device or emulator.
