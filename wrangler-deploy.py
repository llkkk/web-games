#!/usr/bin/env python3
"""Deploy dist/ to Cloudflare Pages via wrangler.

Auth: exchanges the stored custom.cloudflare credential for a short-lived
surrogate and exports it as CLOUDFLARE_API_TOKEN. The surrogate (hsurr:*)
is never the real credential and is never printed.
"""
import os
import subprocess
import sys

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import dynamic_credential_entry

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(PROJECT_DIR, "dist")


def main():
    if not os.path.isdir(DIST):
        print(f"dist not found: {DIST}", file=sys.stderr)
        sys.exit(2)
    entry = dynamic_credential_entry("custom.cloudflare")
    surrogate = entry["surrogate"]  # never print this
    env = dict(os.environ)
    env["CLOUDFLARE_API_TOKEN"] = surrogate
    env["CLOUDFLARE_ACCOUNT_ID"] = "c46fb124ef3766914c9d3d22339f2554"
    cmd = [
        "npx", "-y", "wrangler@latest", "pages", "deploy", DIST,
        "--project-name=web-games",
        "--branch=main",
        "--commit-dirty=true",
    ]
    print("running:", " ".join(cmd[:4]), "...")
    proc = subprocess.run(cmd, cwd=PROJECT_DIR, env=env,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, timeout=600)
    # surrogate never appears in output; print wrangler's log for diagnosis
    print(proc.stdout[-4000:])
    sys.exit(proc.returncode)


if __name__ == "__main__":
    main()
