# Workflow: one lead per phase + workers

Goal: build fast, with quality, and leave nothing hanging. The files keep track of the
work, not the sessions.

## The loop
1. **Lead** (one per phase) reads PLAN.md, STATUS.md and the new reports, and writes the
   specs for the phase's sub-phases (`docs/specs/NNN-name.md`), each with its model,
   effort and skills.
2. **Lead** launches the workers: 2 at a time, one fresh session per spec.
3. **Worker** implements its spec, verifies it, runs `reviewer` where required, pushes its
   branch, opens the PR (ready for review once CI is green), writes
   `docs/reports/NNN-name.md`, messages the lead with a ≤10-line summary, and stops.
4. **Lead** checks the report against the spec's acceptance criteria, spot-checks the
   diff, merges (one PR at a time, `docs/specs/ola0-00-como-mergear.md`), checks CI on
   `main` and the staging deploy, archives the worker session and launches the next
   sub-phase.
5. Back to 3 until the phase is done; then the lead closes the phase (below).

## Rules
- **Permanent state lives in files:** PLAN.md, STATUS.md and docs/reports/. Any new
  session can pick up from them.
- **One lead per phase.** It lives while the phase is active. After a pause of over 1 h,
  run `prompts/LEAD-HANDOFF.md`, close it and open a new lead with `prompts/LEAD-START.md`.
  Don't resume a session idle for over 1 h.
- **Plan in waves.** Only the current phase has full specs; later phases stay as bullets.
- **Always 2 workers in parallel;** 3 only if none shares files or a migration with
  another. Specs that touch the same files run in sequence. More than 3 doesn't go
  faster: `main` takes one merge at a time and each waits ~25 min of CI.
- **Only the lead merges and only the lead edits STATUS.md.** Workers don't merge and
  don't touch STATUS.md or `docs/scope.yaml`: their status line goes in the report.
- **Workers never take a second task.** They close when the report is written.
- **Lead reviews results, not all the code:** report pass/fail, verify output, a
  spot-check of the diff. If something is missing, the lead writes a short fix spec for
  a new worker; it doesn't fix it itself.
- **`reviewer` is mandatory** before a PR is ready when the spec touches auth, RLS,
  migrations, customer data, agent permissions, payments, integrations or the worker.
- **Skills:** the lead looks at `.claude/toolkit/SKILLS-INDEX.md` and writes the
  `Skills:` line of each spec (0–2). Workers load only those.
- **Specs are small and self-contained:** 5–8 files, with the exact files and the verify
  commands. Over ~10 files or one day of work, split it.
- **Blocked worker** writes the blocker in its report and stops. It doesn't improvise scope.
- **The lead asks Diego before merging** a PR that changes an existing assertion or
  touches something outside its spec.

## Closing a phase (nothing pending without an owner)
- Every follow-up from every report ends as a written spec, a row in `docs/scope.yaml`,
  or "discarded" with a reason. The phase doesn't close while one is unclassified.
- The last sub-phase of each phase is a clean-up: a worker reviews what the phase built
  (duplicates, dead code, missing tests, stale docs) and fixes it or leaves a spec.
- Everything "built, not verified for real" stays as Blocked in STATUS.md, with the
  manual task that unblocks it.
- One docs PR: STATUS.md (≤60 lines), the PLAN.md decisions log and the next phase's
  specs. Then LEAD-HANDOFF.

## Models (choose at session start, never switch mid-session)
| Session | Model | Effort |
| --- | --- | --- |
| Lead | the most capable model available | High |
| Worker: auth, RLS, migrations, customer data, agent permissions, payments, integrations, the worker | Opus | High |
| Worker: any other code | Opus | Medium |
| Worker: docs only or mechanical | Sonnet | High |
| explore agent | Haiku | — |
| reviewer agent | Opus (launched with `model: opus`) | — |

## Where to run
- Lead and workers: cloud sessions. The lead launches each worker as a new session and
  doesn't follow it turn by turn: it waits for the worker's message, with a 90-minute
  check-in as a safety net.
