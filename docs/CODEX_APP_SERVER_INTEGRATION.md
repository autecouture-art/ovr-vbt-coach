# Codex App Server Integration

## Purpose

RepVeloCoach will move away from GLM as the implementation worker. The default
developer workflow should use the Codex subscription through Codex App, Codex CLI,
and Codex App Server where useful.

This document deliberately separates two concerns:

- App runtime coaching: should work without paid API calls whenever possible by
  using local VBT rules, load-velocity history, MVT, velocity loss, ROM, and RPE.
- Developer/admin automation: may use Codex App Server so Codex can inspect the
  repo, run checks, review diffs, and help with controlled changes.

Codex App Server is not the primary replacement for the in-app AI coach. It is a
developer/admin bridge for Codex-driven work.

## Current Direction

1. Keep the mobile app valuable without live LLM access.
   - VBT guidance, velocity-loss stopping rules, top-single checks, and block
     recommendations should be deterministic app logic.
   - The AI chat path remains optional.

2. Replace GLM-based implementation work with Codex.
   - Use Codex App/CLI for implementation, review, and TestFlight preparation.
   - Do not require GLM/Claude CLI workers for future tasks.

3. Introduce Codex App Server cautiously.
   - Start with `stdio://`, which is the default transport.
   - Do not expose WebSocket transport to the network.
   - If WebSocket is ever needed, use loopback only and capability-token auth.

## Why stdio First

The official Codex App Server protocol supports `stdio://` by default and marks
WebSocket as experimental. Non-loopback WebSocket listeners can allow
unauthenticated connections unless explicitly configured, so RepVeloCoach should
not use remote WebSocket exposure as its first integration step.

Reference: https://developers.openai.com/codex/app-server

## Repo Commands

Check that this machine has a usable Codex App Server CLI and that schema
generation works:

```bash
pnpm codex:app-server:check
```

Generate version-matched protocol schemas into a temporary folder:

```bash
codex app-server generate-json-schema --out /tmp/repvelo-codex-schemas
codex app-server generate-ts --out /tmp/repvelo-codex-schemas-ts
```

Start the default stdio server only from a controlling client process:

```bash
codex app-server
```

Do not start this as a public daemon.

Run the local-only admin client over stdio:

```bash
pnpm codex:app-server:admin -- --prompt "Review current changes and summarize the highest risks"
```

Use a canned local review workflow:

```bash
pnpm codex:app-server:admin -- --preset review
pnpm codex:app-server:admin -- --preset testflight
pnpm codex:app-server:admin -- --preset vbt-plan
pnpm codex:app-server:admin -- --preset performance
pnpm codex:app-server:admin -- --preset release-notes
```

The repo-local client defaults to `gpt-5.4` because the currently verified
`codex-cli 0.101.0` rejects the newer `gpt-5.5` default. Override when the CLI is
updated:

```bash
CODEX_APP_SERVER_MODEL=gpt-5.5 pnpm codex:app-server:admin -- --preset review
pnpm codex:app-server:admin -- --model gpt-5.3-codex-spark -- --preset review
```

Show the available presets:

```bash
pnpm codex:app-server:admin -- --list-presets
```

Meaningful App Server run outputs are recorded in
`docs/CODEX_APP_SERVER_RUNS.md`.

Dry-run the exact JSON-RPC messages without starting Codex:

```bash
pnpm codex:app-server:admin -- --dry-run --prompt "Summarize TestFlight readiness"
pnpm codex:app-server:admin -- --dry-run --preset testflight
```

Review/admin presets default to a read-only sandbox with network access disabled.
Use `--write` only for an explicit implementation turn:

```bash
pnpm codex:app-server:admin -- --write --prompt "Implement the smallest safe fix for ..."
```

If the protocol needs troubleshooting, print raw server messages:

```bash
pnpm codex:app-server:admin -- --debug-json --preset review
```

## Security Rules

- Do not embed OpenAI API keys in the iOS app for distributed builds.
- Do not expose `codex app-server --listen ws://0.0.0.0:...`.
- Do not give Codex broad filesystem scope when a task only needs this repo.
- Prefer repo-local commands and narrow working directories.
- Keep backups before file edits, especially while the working tree is already
  dirty.
- Record App Server usage in `docs/AGENT_WALKTHROUGH.md`.

## Proposed Phases

### Phase 1: Local Readiness

- Add a repo-local App Server check script.
- Document the safe transport policy.
- Confirm `codex app-server generate-json-schema` works on the current machine.

### Phase 2: Codex-First Developer Workflow

- Stop assigning new implementation work to GLM.
- Use Codex App/CLI directly for implementation and review.
- Keep TestFlight build/upload through repo-local scripts.

### Phase 3: Admin Client Prototype

Build out the local-only admin client that spawns `codex app-server` over stdio
and can start scoped threads such as:

- Review current uncommitted changes.
- Summarize performance risks before TestFlight.
- Produce a VBT implementation checklist from tracker entries.
- Draft TestFlight release notes for the user.

The prototype must default to the RepVeloCoach repo path and should not start a
remote listener.

The first version uses `approvalPolicy: "never"` and disables network access in
the turn-level sandbox policy. Review/admin turns start the thread with
`sandbox: "read-only"` and then override turns with a `readOnly` sandbox policy;
`--write` must be explicit for implementation-oriented turns. That keeps it
useful for review/summarization without silently approving shell actions or file
edits.

Available presets:

| preset | purpose |
| --- | --- |
| `review` | Review current uncommitted changes by severity. |
| `testflight` | Check release readiness without uploading or using network. |
| `vbt-plan` | Plan deterministic VBT coaching work that does not require API billing. |
| `performance` | Investigate long-session slowdown risks from repo-local code. |
| `release-notes` | Draft user-facing TestFlight notes from current changes/logs. |

### Phase 4: Optional App Runtime AI

Only if the user later accepts API billing or a private server:

- Replace GLM-specific naming with generic `AI Provider`.
- Add an OpenAI-backed server provider.
- Keep deterministic VBT coaching as the fallback path.

## Current Decision

Proceed with Phase 1 and Phase 2 now. Phase 3 has a first local-only client
scaffold; expand it after the app's current VBT/manual-entry/TestFlight work is
stable.
