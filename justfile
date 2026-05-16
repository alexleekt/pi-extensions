# Pi Extensions Monorepo Tasks

_default:
    just --list

# Format all packages
fmt:
    npx @biomejs/biome format --write .

# Lint all packages (extension code only; webview has its own build toolchain)
lint:
    npx @biomejs/biome check packages/pi-shared/session.ts \
        packages/pi-bump packages/pi-pkg-guard \
        packages/pi-ask-user-glimpse/index.ts \
        packages/pi-ask-user-glimpse/tool \
        packages/pi-ask-user-glimpse/shared \
        packages/pi-ask-user-glimpse/fallback \
        packages/pi-ask-user-glimpse/types \
        packages/pi-ask-user-glimpse/scripts

# Type-check all packages
typecheck:
    for pkg in packages/*/; do \
        echo "Type-checking $pkg..."; \
        (cd "$pkg" && if npm run typecheck 2>/dev/null; then :; else npm run check; fi); \
    done

# Publish a package (usage: just publish pi-bump)
publish pkg:
    cd packages/{{pkg}} && npm publish --access public

# Bootstrap a NEW package on npm (first-time publish from local machine)
# Usage: just bootstrap pi-shared
# Requires: npm login (local auth) + Trusted Publishing setup on npmjs.com after
bootstrap pkg:
    cd packages/{{pkg}} && npm publish --access public

# Release a package: bump version, commit, tag, push (triggers publish.yml)
# Usage: just release pi-bump 0.3.0
release pkg version:
    cd packages/{{pkg}} && npm version --no-git-tag-version {{version}}
    git add packages/{{pkg}}/package.json package-lock.json
    git commit -m "chore({{pkg}}): release v{{version}}"
    git tag "@alexleekt/{{pkg}}@{{version}}"
    git push origin main "@alexleekt/{{pkg}}@{{version}}"
