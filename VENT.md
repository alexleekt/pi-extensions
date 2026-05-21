# VENT

Feedback log. Repeated/systemic workflow friction that should become future automation, docs, or workflow fixes.

## 26-05-20 22:53 — pi-heading-publish-debug-loop

Iterated 9 times on the pi-heading publish workflow (.github/workflows/publish.yml), creating 6+ debugging commits on main. Root cause turned out to be a token-scope/npm-registry auth issue that can't be fixed via .npmrc manipulation. Should have recognized sooner that ENEEDAUTH persisting across perfectly-formatted .npmrc files indicated the token itself lacked package-level permissions, not a file-parsing issue.
