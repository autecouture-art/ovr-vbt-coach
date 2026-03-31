# Project Rules (Agent Handoff)

These rules apply to any agent working in this repo.

## Mandatory Walkthrough Log
- Always maintain a running walkthrough log at `docs/AGENT_WALKTHROUGH.md`.
- Each work session must append a new entry with date, agent/model, scope, actions, results, and remaining tasks.
- If the active agent/model changes (Codex/Claude/GLM/Gemini), record the switch and why.

## Incident Recording
- Any troubleshooting, build issues, outages, or unexpected errors must be recorded in the walkthrough log.
- Include the resolution steps and the confirmed outcome.

## Build/Release Trace
- When TestFlight builds are produced, log build number, version, and upload status.
- Note any retries or environment variables used to stabilize the build.
