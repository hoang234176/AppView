# AppView — Agent Instructions

## Read first

Before implementing, read applicable architecture and current-state docs:
- `ARCHITECTURE.md` — verified directory tree, service responsibilities, API map, shared contracts
- `CURRENT_STATE.md` — completed work, in-progress items, known issues
- The nearest `AGENTS.md` for the subtree you are modifying

If docs and implementation disagree, inspect the relevant code and report the discrepancy instead of guessing.

## Change discipline

- Make the smallest required change.
- Do not perform unrelated refactors.
- Preserve public API contracts unless explicitly asked for a breaking change.
- Prefer backward-compatible changes.
- Avoid unnecessary dependencies.
- Do not change deployment topology unless requested.

## Architecture boundaries (verified)

```text
Frontend Web / Mobile
        |
        v
   Coordinator  (:8090)
     ^        ^
     | WS      | WS
 Download    Storage
 worker      worker
```

- **Coordinator** owns orchestration and the two-stage download-job pipeline.
- **Download** (`resolve_download`) resolves URLs only; it does not own filesystem paths.
- **Storage** (`download_file`) owns all local filesystem/media operations, including cookie files on disk (`~/.tmp-appview/cookies/`).
- **Cookie storage boundary**: Download worker MUST NOT read or write cookie files directly on disk. It must query/save cookies through Coordinator RPC (`cookie.get` / `cookie.save`), which delegates to Storage worker.
- New normal download flows go through Coordinator `POST /api/v1/download`.
- DO NOT send raw media/file payload bytes through worker WebSockets.
- DO NOT add new direct frontend → Download worker paths for normal downloads.

## Security

- Never expose passwords, tokens, cookies, or secret environment values in logs, responses, or source.
- Preserve path traversal protections in Storage.
- Do not commit real secrets. `.env.example` files contain safe placeholders only.
- The root `.gitignore` ignores `.env` and `.env.*` at every depth but allows `.env.example`.

## Git / worktree safety

- Do not revert unrelated user changes.
- Existing staged/unstaged work is user work unless clearly created by the current task.
- Do not commit or push unless explicitly requested.

## New service / app rule

When creating a new independently deployable backend service or frontend application, you MUST also create an `AGENTS.md` in that new service/app root. Examples:

```text
backend/auth/        → backend/auth/AGENTS.md
frontend/desktop/    → frontend/desktop/AGENTS.md
```

The new child `AGENTS.md` MUST:
- contain only rules specific to that subtree (do not duplicate root rules)
- document the service/app responsibility and key architecture boundaries
- document relevant API/protocol invariants
- document security/path/data invariants where applicable
- document actual validation/build commands supported by that subtree
- remain concise and durable; avoid temporary debugging notes

If the new service introduces a new architecture boundary, protocol, or public API contract, update the appropriate architecture/protocol documentation in the same task.

## Finishing

Before finishing, run from the relevant subtree, then also run:

```bash
git diff --check
git status --short
git diff --stat HEAD
```

Final reports must summarize: root cause/reason, files changed, implementation, validation, remaining limitations.
