# Codex App Server Runs

This file records meaningful Codex App Server runs so later agents can continue
from the actual output instead of rediscovering the same context.

## 2026-05-11: `vbt-plan`

Command:

```bash
pnpm codex:app-server:admin -- --preset vbt-plan --note "Read-only. Do not modify files. Keep the answer concise."
```

Result:

- App Server launched successfully through stdio.
- The first attempt failed because the configured default `gpt-5.5` model
  required a newer Codex CLI than `codex-cli 0.101.0`.
- The admin client was updated to default to `gpt-5.4`.
- The second run completed in read-only mode and produced a usable VBT plan.

Findings from the run:

1. `P1`: Add a unified deterministic VBT coach engine.
   - Combine Average Velocity, Velocity Loss, MVT, ROM, top single status, and
     backoff decisions into one pure service.
   - Candidate: `src/services/DeterministicVBTCoach.ts`.
   - Connect to `src/services/AICoachService.ts` and `app/(tabs)/session.tsx`.
   - Test fixed scenarios: fast day, normal day, fatigued day, short ROM, and
     missing MVT.

2. `P2`: Convert top-single and backoff guidance from text into decisions.
   - Current app already has protocol display and live VL warnings.
   - Missing piece: a decision object such as `continue`, `stop`, `reduce_load`,
     or `top_single_complete`.
   - Use MVT offset and VL thresholds to choose the next action.

3. `P3`: Make manual entry feed the deterministic coach.
   - Manual input currently leaves velocity, VL, and ROM fields nullable in some
     paths, which limits API-free coaching.
   - Manual top single and backoff entries should produce the same coach output
     as sensor-derived sets when enough data is supplied.

4. `P4`: Strengthen MVT and ROM quality gates.
   - Existing MVT and short-ROM logic should become part of the coach quality
     gate.
   - Low-sample, high-variance, or short-ROM data should reduce confidence or
     avoid updating LVP/MVT.

Residual critical items:

- First-set duplicate recording remains critical.
- Long-session slowdown/freezing remains critical.
