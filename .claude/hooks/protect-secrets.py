#!/usr/bin/env python3
"""PreToolUse hook: block Claude from editing secret files.
Exit code 2 blocks the tool call; stderr is shown to Claude as the reason."""
import json
import re
import sys

PROTECTED = [
    r"(^|/)\.env(\..*)?$",          # .env, .env.local, .env.production
    r"(^|/)secrets?/",              # secrets/ or secret/ folders
    r"\.(pem|key|p12|pfx)$",        # private keys and certificates
    r"(^|/)id_(rsa|ed25519)",       # ssh keys
    r"credentials\.json$",
    r"service[-_]account.*\.json$",
]

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # never break the session on bad input

tool_input = data.get("tool_input", {}) or {}
path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""

if any(re.search(p, path) for p in PROTECTED):
    # .env.example and similar templates are allowed
    if not re.search(r"\.(example|sample|template)$", path):
        print(
            f"Blocked: '{path}' is a protected secrets file. "
            "Ask Diego to change it manually.",
            file=sys.stderr,
        )
        sys.exit(2)

sys.exit(0)
