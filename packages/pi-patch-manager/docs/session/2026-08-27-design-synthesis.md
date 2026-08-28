# Design synthesis

This scaffold keeps the v0.1 implementation in `index.ts`: registry discovery, strict hand-written manifest validation, npm-style package resolution, deterministic SHA-256 hashing, Git dry-run inspection, command registration, and the read-only status tool.

The command surface is intentionally narrow. List, status, explain, and disable are safe registry operations; apply and rebase remain explicit stubs. No patch mutation, dependency on patch-package, LLM integration, history, or automation is included. Package roots are constrained to Pi's agent locations and the project working directory, and all package files are treated as untrusted input.
