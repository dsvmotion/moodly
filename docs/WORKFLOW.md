# Workflow: lead + workers

Goal: build fast with small contexts. The files keep track of the work, not the sessions.

## The loop
1. **Lead** reads PLAN.md, STATUS.md and new reports, then reviews the finished tasks.
2. **Lead** writes specs for the next 1–3 tasks (`docs/specs/NNN-name.md`) and updates STATUS.md.
3. **Workers** each take one spec in a fresh session, implement it, verify it, write
   `docs/reports/NNN-name.md`, add one line to STATUS.md, and stop.
4. Back to 1. At each milestone, or when the lead session gets long, run
   `prompts/LEAD-HANDOFF.md`, close the session and open a new lead with `prompts/LEAD-START.md`.

## Rules
- **Plan in waves.** Only the next wave has full specs; later phases stay as bullets.
- **Parallel only if independent.** Run 2–3 workers at once only when their specs touch
  different files or modules. Otherwise run them in sequence.
- **Workers never take a second task.** Close the session when the report is written.
- **Don't resume a session idle for over 1 h.** Start fresh from the files instead.
- **Lead reviews results, not all the code:** report pass/fail, verify output, a spot-check
  of the diff. Critical areas (auth, payments, customer data, agent permissions) also get a
  `reviewer` agent pass.
- **Spec too big?** If a task needs more than ~10 files or more than one day, split it.
- **Blocked worker** writes the blocker in its report and stops. It doesn't improvise scope.

## Models (choose at session start, never switch mid-session)
| Session | Model | Effort |
| --- | --- | --- |
| Lead | Opus | Medium (High only for architecture decisions) |
| Worker | Sonnet | Medium (High for hard bugs or security) |
| explore agent | Haiku | — |
| reviewer agent | Sonnet | — |

## Where to run
- Lead: local Claude Code, where you can watch it and stop it early.
- Workers: local terminals or cloud sessions. Cloud is fine for self-contained specs; max 2
  cloud workers at once.
