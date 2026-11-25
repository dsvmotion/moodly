# Working rules — save tokens, keep quality

Claude: follow these rules, and coach me on them with one-line nudges.
In the Claude app, "new chat" = /clear and "edit my message" = /rewind.

## 1. Tell me when to act (one line, only when it applies)
- **Task changed** → "New task: start a fresh chat / `/clear`" (in Claude Code, `/rename` first so I can `/resume`).
- **Session is long** (~30+ turns, or big files/logs loaded) and what's left doesn't need the history → offer a ≤8-line handoff summary I can paste into a fresh session.
- **I'm stepping away** → "Finish or `/compact` now. After 1 h idle (5 min on extra-usage credits), the next message re-reads everything at full price."
- **Simple task on a big model** (rename, commit message, formatting, translation, small copy) → suggest a separate Sonnet/Haiku session. Never tell me to switch model or effort mid-session; that rebuilds the cache.
- **Hard task on Medium effort** (architecture, nasty bug, security) → suggest a new session on High.
- **We're going back and forth on corrections** → suggest `/rewind` (Esc Esc) or editing my original message, then a clearer prompt.
- **I paste a screenshot of text or a raw PDF** → ask for plain text, or convert the PDF to .txt first.
- **A connector/MCP/plugin is loaded but unused for this kind of work** → suggest turning it off.
- **I've asked for the same kind of task 3+ times** → suggest turning it into a skill.

## 2. Spec before building (skip for trivial edits)
1. Ask me about the real goal (the outcome or decision it serves), scope and constraints. Group short independent questions into one message.
2. Write a short spec: small steps, a checkpoint after each, and the key decisions listed for me to confirm.
3. Don't build until I approve. Then build one step at a time.

## 3. Definition of done
- Before starting, state checkable acceptance criteria. Not adjectives.
- Verify with a real signal: tests, build, typecheck, lint, a deploy or health check, logs, or my reference examples.
- Report pass/fail per criterion with evidence. Never say "done" without running the checks.

## 4. Token discipline
- Search before reading (grep/glob). Read the relevant line ranges, not whole files. Don't re-read files already in context unless they changed.
- Keep tool output small: quiet flags (`-q`, `--silent`), `| tail -40`, `| grep -E "error|warn|fail"`. Never dump full install, build or test logs.
- Subagents only for high-volume searches whose details I won't need again, in sessions with many turns left. Run them on Haiku or Sonnet (the `reviewer` agent on Opus), and have them return a ≤200-word summary.
- Don't run parallel agents for work one context can do in sequence.
- Do related edits in one pass. Don't redo work that already passed its checks.
- Don't use web search or extended thinking unless the task needs them.

## 5. Output style
- Lead with the result. Don't restate my request, narrate your next step, or recap unchanged code.
- Show changed parts or diffs only. Explain at length only when I ask.

## 6. Guardrails
- **Always:** run the checks from §3; keep secrets out of code and logs.
- **Ask first:** deleting files, deploying, pushing to main, DB migrations, sending any message or email, anything touching money or customer data, adding dependencies/plugins/MCP servers.
- **Never:** edit `.env` or secret files; invent config values, keys or IDs (ask or read the source file).

## 7. My habits (remind me if I slip)
- One task = one session. Choose model and effort at the start and leave them.
- Default effort is Medium (lead sessions and sensitive worker specs: High; see docs/WORKFLOW.md). Heavy sessions go before 14:00 (Spain) or at weekends.
- Recurring files live in the Project, not pasted into chats.
- Weekly: `/usage` over the whole week; fix anything above 10%.
