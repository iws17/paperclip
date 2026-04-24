---
title: Hermes Local
summary: Hermes local adapter setup, configuration, prompt templating, and local patch notes
---

The `hermes_local` adapter runs the Hermes CLI locally through the `hermes-paperclip-adapter` package.

Use this doc when you need:

- config fields for a `hermes_local` agent
- prompt template variables
- runtime behavior and session semantics
- the current local `instructionsFilePath` patch note

## Prerequisites

- Hermes installed and runnable as `hermes` on the host
- Python 3.10+
- At least one configured model/provider in Hermes
- `hermes-paperclip-adapter` installed in the Paperclip server environment

## Configuration Fields

### Core

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | string | No | Model in `provider/model` form. Default is adapter-defined. |
| `provider` | string | No | Provider override. Leave unset for adapter auto-detection. |
| `timeoutSec` | number | No | Execution timeout in seconds. |
| `graceSec` | number | No | Grace period before force-kill. |
| `promptTemplate` | string | No | Custom prompt template for heartbeat runs. |
| `env` | object | No | Extra environment variables for the Hermes process. |

### Session and runtime

| Field | Type | Required | Description |
|---|---|---|---|
| `persistSession` | boolean | No | Resume the previous Hermes session across heartbeats. |
| `hermesCommand` | string | No | Explicit path or command name for the Hermes binary. |
| `worktreeMode` | boolean | No | Enable worktree isolation for runtime execution. |
| `checkpoints` | boolean | No | Enable filesystem checkpoints for rollback safety. |
| `verbose` | boolean | No | Enable verbose Hermes output. |
| `quiet` | boolean | No | Use quieter CLI output for cleaner transcript parsing. |
| `extraArgs` | string[] | No | Additional Hermes CLI arguments. |

### Tools

| Field | Type | Required | Description |
|---|---|---|---|
| `toolsets` | string | No | Comma-separated toolsets to enable. |

Available toolsets include:

- `terminal`
- `file`
- `web`
- `browser`
- `code_execution`
- `vision`
- `mcp`
- `creative`
- `productivity`

## Prompt Template Variables

The adapter supports `{{variable}}` interpolation in `promptTemplate`.

| Variable | Description |
|---|---|
| `{{agentId}}` | Paperclip agent ID |
| `{{agentName}}` | Agent display name |
| `{{companyId}}` | Company ID |
| `{{companyName}}` | Company name |
| `{{runId}}` | Current heartbeat run ID |
| `{{taskId}}` | Assigned issue/task ID |
| `{{taskTitle}}` | Task title |
| `{{taskBody}}` | Task instructions |
| `{{projectName}}` | Project name |
| `{{paperclipApiUrl}}` | Paperclip API base URL |
| `{{commentId}}` | Comment ID when woken by comment |
| `{{wakeReason}}` | Why the run was triggered |

Conditional blocks:

- `{{#taskId}}...{{/taskId}}`
- `{{#noTask}}...{{/noTask}}`
- `{{#commentId}}...{{/commentId}}`

## Runtime Behavior

- The adapter invokes Hermes in single-run CLI mode per heartbeat.
- When `persistSession` is enabled, session state is resumed across heartbeats.
- Stdout/stderr is parsed into structured `TranscriptEntry` records so Paperclip can render tool calls, tool results, system messages, and final results.
- The adapter exposes skills integration and session codec support in addition to execute/test behavior.

## Instructions Resolution

### Upstream behavior

On the published adapter alone, `instructionsFilePath` is not yet a stable upstream guarantee for `hermes_local`.

### Local ZHC behavior

This environment uses a local patch carried in `hermes-paperclip-adapter` so `config.instructionsFilePath` is read, loaded, and prepended to the Hermes prompt.

That patch logs:

```text
[hermes] Loaded agent instructions from <path>
```

If that line does not appear during a Hermes heartbeat, treat the adapter patch as suspect.

## Patch Discipline

**UPDATED 2026-04-23**: this section is superseded. The adapter is now carried via native `pnpm.patchedDependencies` (`patches/hermes-paperclip-adapter@0.3.0.patch`), so `pnpm install` auto-applies the patch. No manual re-apply needed on paperclip-server HEAD ≥ `ba01463f`. See `Architecture/Specs/paperclip/zhc-config.md` §12.1.

---

_The flow below is retained as historical reference for environments still running the legacy `postinstall-reapply.sh` pattern. Do NOT run it against a repo that has the `pnpm patch` in place — it would overwrite the patched store dir with dist from the local fork (which lacks the feature on main)._

In this environment, `pnpm install` in `paperclip-server` can wipe the patched adapter copy from the pnpm store.

After any `pnpm install` in `paperclip-server`, re-run the patch reapply flow described in:

- `/Users/dg/Documents/data/research/Architecture/Specs/paperclip/ops-runbook.md`
- `/Users/dg/Documents/data/research/Architecture/Specs/paperclip/zhc-config.md`

The operator loop also handles this through:

```bash
python3 /Users/dg/Documents/data/research/Architecture/Specs/paperclip/scripts/paperclipctl.py fix
```

or as part of:

```bash
python3 /Users/dg/Documents/data/research/Architecture/Specs/paperclip/scripts/paperclipctl.py morning
```

## Verification

Minimal checks:

1. Hermes binary is available.
2. A `hermes_local` heartbeat completes.
3. Logs show `[hermes] Loaded agent instructions from ...` when `instructionsFilePath` is configured.
4. The agent transcript contains structured tool/system output rather than raw shell noise.

## Related Docs

- [Adapter overview](/Users/dg/Documents/data/research/projects/paperclip-server/docs/adapters/overview.md)
- [Paperclip ops runbook](/Users/dg/Documents/data/research/Architecture/Specs/paperclip/ops-runbook.md)
- [ZHC config overlay](/Users/dg/Documents/data/research/Architecture/Specs/paperclip/zhc-config.md)
- [Hermes adapter repo README](/Users/dg/Documents/data/research/projects/hermes-paperclip-adapter/README.md)
