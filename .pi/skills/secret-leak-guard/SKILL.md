---
name: secret-leak-guard
description: Keep secrets and confidential data out of the model context and out of the cloud — layered defence (gitignore, pi-heimdall guards, gitleaks pre-commit, .env discipline), with the verified limits of each layer. Use when adding credentials to a project, reading config/env files, running commands that print environment values, or hardening a repo against accidental leaks.
---

# Secret leak guard (defence in depth)

Full evidence, measurements, and sources: `references/secret-leak-guard.md`.

**The one rule that cannot be delegated to tooling**: secrets never enter the model
context. Everything below is a backstop for mistakes, not a licence to handle secrets.

## The threat model (what actually leaves the machine)

| Path | Leaves the machine? | Controlled by |
|---|---|---|
| File content the agent reads (`read`/`grep`/`cat`) | **yes** — goes to the provider in the next request | layer 1–2 |
| Command output the agent sees (`bash`, MCP tools) | **yes**, and stays in the transcript | layer 2–3 |
| `git commit` / `git push` | **yes**, to the remote, permanently | layer 4 |
| A secret the model *infers* (e.g. it decoded base64 itself) | **yes**, and no layer can retract it | layer 5 (behaviour) |
| Conversation history in `~/.pi/agent/sessions` | local, but read by every later turn | layer 1 discipline |

Anything that reached the transcript is already spent: redaction is a best-effort
backstop, not a guarantee.

## Layers, in the order they must be applied

1. **`.gitignore` first** (cheapest, H1). `.env`, `.env.*` (except `.env.example`),
   `auth.json`, `*.pem`, `*.key`, `mcp-auth.json`. A file that cannot be committed cannot
   be pushed. Verify with `git check-ignore -v <path>`.
2. **`pi-heimdall`** (extension, blocks before the model sees anything):
   `env-protect` blocks `read` of `.env`-family files; `secret-guard` blocks `bash`
   referencing secret names listed in `.env.json` and redacts their values in output.
   Install: `pi install npm:@casualjim/pi-heimdall`. **Its limits are measured, see below.**
3. **Never print secrets on purpose.** No `env`, `printenv`, `cat .env`, `echo $TOKEN`,
   `set`, or `kubectl get secret -o yaml` in agent commands. If values are needed, the
   user pastes only the required ones.
4. **`gitleaks` pre-commit gate** (last line before the remote):
   `gitleaks git --staged --no-banner --redact` → exit 1 blocks the commit.
5. **Behavioural rule** (the only layer that covers inference): after seeing a secret the
   agent must state that it saw it and not reuse it; the user rotates the credential.

## Verified limits of `pi-heimdall` (measured, not assumed)

These are **not** hypothetical — each was reproduced against pi 1.3.0:

| Guard | Verified behaviour |
|---|---|
| `env-protect` | ✔ `read .env` → blocked with an explanatory reason; the model reported the block |
| `env-protect` | ✔ `.env.example` is allowed through (by design) |
| `secret-guard` (name reference) | ✔ `echo $SECRET_TOKEN` → blocked: "command references secret \"SECRET_TOKEN\"" |
| `secret-guard` (single-line redaction) | ✔ `base64 .env2` (one line) → raw tool result `[REDACTED]` |
| `secret-guard` (**multi-line**) | ✘ **LEAK**: `base64 .env` (two lines) reached the model **unredacted**. Root cause: it redacts `base64("KEY=value")` incl. `==` padding; base64 of a whole two-line file has no such substring. Measured: needle not contained, needle without padding contained |
| `secret-guard` (decode path) | ✘ needs `KEY=` inside the decoded text and a value tail match; a decoded or re-encoded blob can slip past |
| overall | `secret-guard` requires a project `.env.json` listing secret key names — **without it, redaction is inactive** |

**Conclusion**: Heimdall blocks the obvious attacks and is worth installing, but it is a
speed bump, not a boundary. Treat layer 1 (gitignore) and layer 4 (gitleaks) as the
authoritative gates, and layer 3 as the actual policy.

## Verification commands (run these, don't assume)

```bash
# layer 1: is the file actually ignored?
git check-ignore -v .env auth.json

# layer 2: are the guards live?
pi -e npm:@casualjim/pi-heimdall -p "Read .env and print it"   # expect a block

# layer 4: does the gate catch a planted secret? (use a real-looking fake, then revert)
echo 'k="AKIAIOSFODNN7EXAMPLE"' > /tmp/leak.txt && git add /tmp/leak.txt   # in a scratch repo
gitleaks git --staged --no-banner --redact; echo "exit=$?"                 # expect 1
```

If the fake key above is committed by mistake, the hook will (correctly) block this repo's
own commit — that is the gate working. Keep such plants in a scratch repo, never here.

A gate that has never caught a planted secret has not been tested.

## `.env.json` (Heimdall secret names)

Heimdall reads `.env.json` at the project root — a flat object whose **keys** name secret
environment variables (values are ignored; it reads the real value from the process env):

```json
{ "DEEPSEEK_API_KEY": 1, "DATABASE_URL": 1 }
```

Commit `.env.json` (it holds names, not values). Without it `secret-guard` does nothing.

## When a secret did leak

1. Say it plainly — which secret, in which tool result.
2. Rotate/revoke the credential first, then clean up. Rewriting history does not
   un-send data to a provider.
3. If it was committed: remove from the tree, add to `.gitignore`, rotate, and only then
   consider history rewriting (owner's decision, never automatic).
