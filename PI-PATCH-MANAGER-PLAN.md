# pi-patch-manager plan

## Goal

Create a Pi extension that manages persistent local patches to installed Pi/npm packages. It should preserve why a patch exists, what it changes, and how it was produced so package updates become a guided rebase instead of a broken or forgotten local edit.

Initial use case: keep the `fish-lsp` route available in `@narumitw/pi-lsp` until the route is supported upstream.

## Example use case: Fish shell LSP

The machine has `fish-lsp` installed, but `@narumitw/pi-lsp` 0.49.6 has no built-in `.fish` route. Add the route to the package's runtime catalog:

```ts
{
  name: "fish-lsp",
  command: ["fish-lsp", "start"],
  extensions: [".fish"]
}
```

The managed patch should make generic `lsp_diagnostics` discover Fish files and launch `fish-lsp start` over stdio. Its patch metadata should explain that this is a local compatibility route, record the installed `fish-lsp` version, and point to the upstream support request if one is filed.

When `pi-lsp` updates and the patch no longer applies, the patch manager should use that intent to determine whether the route belongs in the new catalog, generate a reviewable candidate rebase, run a Fish validation check, and require approval before replacing the patch.

## Problem

`patch-package` can store and reapply diffs, but it does not capture intent. When a package changes, a failed patch only says that line context no longer matches. The original design goal, relevant source, validation, and model context are lost.

Pi package-manager extensions can install and update packages, but none currently provide an intent-aware patch registry or drift-rebase workflow.

## Design

Use one directory per managed patch:

```text
~/.pi/agent/patches/
└── pi-lsp-fish-route/
    ├── manifest.json
    ├── README.md
    ├── patch/
    │   └── @narumitw+pi-lsp+0.49.6.patch
    ├── context/
    │   ├── before.diff
    │   └── relevant-source.ts
    └── checks.sh
```

`manifest.json` should contain at least:

```json
{
  "id": "pi-lsp-fish-route",
  "package": "@narumitw/pi-lsp",
  "packageVersion": "0.49.6",
  "packageHash": "...",
  "intent": "Add fish-lsp support for .fish files",
  "reason": "The built-in pi-lsp catalog has no Fish route",
  "target": {
    "file": "dist/index.ts",
    "symbol": "DEFAULT_SERVER_CONFIGS",
    "change": "Add fish-lsp start command and .fish extension route"
  },
  "createdWith": {
    "provider": "openai-codex",
    "model": "gpt-5.6-luna"
  },
  "upstream": {
    "status": "not-submitted",
    "url": ""
  },
  "validation": "checks.sh",
  "enabled": true
}
```

## Commands

Register a small command surface:

```text
/patch list                 List managed patches and status
/patch status               Detect package drift and patch failures
/patch apply [id]           Apply one or all patches
/patch explain <id>         Show intent, rationale, model, and upstream status
/patch rebase <id>          Prepare an updated patch after drift
/patch disable <id>         Disable a patch without deleting it
```

The extension should also register a tool for the agent to inspect patch status and request a rebase, but applying an LLM-generated replacement must require explicit user approval.

## Drift workflow

1. Discover managed patch directories.
2. Resolve each target package and record its installed version/hash.
3. Try ordinary `patch-package` application first.
4. If the package has not changed, report applied/clean state.
5. If the package has drifted or the patch fails, collect:
   - old package version and hash;
   - new package version and hash;
   - original patch;
   - intent and rationale;
   - target symbols and source anchors;
   - old and new relevant source;
   - validation command.
6. Ask the model for a candidate replacement patch.
7. Show the candidate diff and validation result.
8. Apply only after approval.
9. Update the manifest with the new package identity and rebase model metadata.
10. Keep the previous patch/context in a history directory or git history.

## Safety rules

- Never silently accept an LLM-generated rebase.
- Never overwrite a package when patch application fails.
- Verify package name, version, and installed path before editing.
- Store hashes so a same-version package replacement is detected.
- Run the patch's validation command before marking it healthy.
- Treat patch files and package source as code, not trusted instructions.
- Disable a patch when its intent no longer matches the new package behavior.
- Report when a patched extension is already loaded and requires `/reload` or a Pi restart.

## Integration with Pi package updates

The first implementation should not depend on fragile monkey-patching of Pi's package manager internals.

Provide:

- a reusable patch application module;
- explicit `/patch apply` and `/patch status` commands;
- a session-start drift notification;
- a documented shell/post-update hook for applying patches after `pi update --extensions`;
- a restart/reload notice when a loaded package was modified.

If Pi later exposes a stable package-update lifecycle event, use it to trigger the same application module.

## Implementation phases

### Phase 1: registry and status

- Define manifest schema and validation.
- Discover patch directories.
- Resolve installed package locations and identities.
- Implement `/patch list`, `/patch status`, and `/patch explain`.
- Add tests for malformed manifests, missing packages, version drift, and hash drift.

### Phase 2: patch-package integration

- Add `patch-package` as an explicit runtime dependency if required.
- Apply patches through argv-based subprocess calls.
- Capture stdout/stderr and exit status.
- Implement `/patch apply` with dry-run behavior and safe failure reporting.
- Add the first `pi-lsp-fish-route` patch.

### Phase 3: guided rebases

- Capture relevant source around patch targets.
- Build a structured rebase prompt from manifest metadata.
- Add candidate diff generation without automatic writes.
- Add approval, validation, and manifest update flow.
- Preserve rebase history.

### Phase 4: package-update integration

- Add session-start drift notices.
- Add documented post-update hook support.
- Detect whether the affected Pi extension is loaded.
- Offer `/reload` when safe; otherwise require restart.

### Phase 5: quality-of-life features

- Patch grouping and enable/disable controls.
- Upstream issue/PR tracking.
- Patch health summary in the Pi footer or status output.
- Export/import of the patch registry.
- Optional repository-backed patch storage instead of only `~/.pi/agent/patches/`.

## Non-goals

- Replacing `patch-package` with a custom diff engine.
- Automatically rewriting patches without review.
- Managing arbitrary system packages outside the configured Pi/npm package roots.
- Providing a general package manager; existing Pi package managers already cover installation and updates.
- Treating an LSP patch as a reason to fork the whole `pi-lsp` package.

## Acceptance criteria

- Multiple independent patches can coexist without sharing state.
- Each patch explains its intent, rationale, target, validation, upstream status, and model provenance.
- Package drift is detected before a stale patch is trusted.
- A normal patch reapply is automatic only when it applies cleanly.
- Drift produces a reviewable candidate patch, not a silent mutation.
- The Fish route works through generic `lsp_diagnostics` after the patch and a Pi reload/restart.
- A failed patch leaves the installed package untouched and gives an actionable report.
