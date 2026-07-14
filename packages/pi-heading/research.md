# Pi 0.80.6 integration audit

Audited 2026-07-13 against the published `@earendil-works/pi-coding-agent` 0.80.6 package, its installed extension/package/session documentation, and current pi-heading source.

## Adopted

| Pi capability | Introduced/current evidence | pi-heading change |
|---------------|-----------------------------|-------------------|
| `agent_settled` | Pi 0.80.4 extension lifecycle | Replace `agent_end` finalization so retries, compaction retries, and queued follow-ups do not produce false completion state |
| `ctx.signal` | Current `ExtensionContext` and pi-ai `StreamOptions` | Forward the active abort signal to topic, goal, and achievement model calls; suppress cancellation notifications |
| `session_tree` | Current session lifecycle | Replay the selected branch's latest persisted heading after `/tree` navigation |
| `getAgentDir()` | Current configuration API | Respect `PI_CODING_AGENT_DIR` and branded distributions instead of hardcoding the default agent directory |
| Pi 0.80 pi-ai compatibility path | Pi 0.80.0 changelog | Import legacy `completeSimple` from `@earendil-works/pi-ai/compat` so published type declarations pass |
| TypeBox 1 schema API | Pi 0.80.6 dependency graph | Use the TypeBox 1 `Object` export and require a compatible peer version |
| Native working-message row | Current UI API | Keep goal and achievement text in `setWorkingMessage()` only; remove custom achievement transcript messages and decorative phase prefixes |
| Declared Pi peers | Current package guidance | Declare coding-agent, pi-ai, pi-tui, and TypeBox peers and require Pi 0.80.4+ |

## Correctness fixes discovered during the audit

1. The npm `files` allowlist omitted `handlers/`, `util/`, and `types.ts`, so the published entrypoint could not load outside the monorepo.
2. In-memory state was keyed to one leaf ID, but assistant/tool/custom entries advance the leaf. Later lifecycle handlers therefore lost the current heading.
3. `/tree` branch navigation did not refresh the displayed heading.
4. A new turn retained the prior turn's achievement until the replacement summary completed.
5. Prompt-derived placeholders could leak raw user text into durable heading state when summarization returned an empty goal; placeholders now remain UI-only and empty summaries use a non-sensitive fallback.
6. Existing config and debug files could retain permissive permissions because creation mode only applies to new files.
7. The package had no realistic packed-install import test; dry-run packing did not reveal missing transitive modules.

## Deferred or rejected

| Pi capability | Decision | Rationale |
|---------------|----------|-----------|
| `pi.setSessionName()` / `session_info_changed` | Defer | Automatic naming could override user-owned `/name` metadata. Heading state and session display name remain separate responsibilities. |
| `setWorkingIndicator()` | Reject | Pi already owns the native loader. Custom frames would duplicate motion and violate the one-row text-only contract. |
| Entry renderers | Reject for achievements | They would avoid model context, but still add transcript noise that the one-line product intentionally avoids. |
| `project_trust` / `isProjectTrusted()` | Not applicable | pi-heading reads user-level configuration and does not execute project-local resources. |
| Async extension factory | Not applicable | Registration is synchronous and no startup network/resource initialization is needed. |
| `systemPromptOptions` | Not applicable | The extension only appends the current goal and does not need to inspect loaded tools, skills, or context files. |
| Provider request/response hooks | Not applicable | Heading requests use pi-ai directly and already receive model/auth/options explicitly. |

## Verification added

- Unit coverage for settled lifecycle, branch-tree replay, ancestor state resolution, abort-signal forwarding, and working-message-only achievements.
- A packed-install smoke test that checks runtime files, excludes tests, installs declared peers, and imports the tarball through Pi's jiti loader.
- CI execution of package-provided packed-import smoke tests.
