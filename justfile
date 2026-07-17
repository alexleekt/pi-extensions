# Pi Extensions Monorepo Tasks

_default:
    just --list

ci_packages := "pi-bump pi-pkg-guard pi-ask-user-glimpse pi-heading pi-worktrunk-signal"

# Format all packages
fmt:
    npx @biomejs/biome format --write .

# Lint the same package scope locally and in GitHub Actions.
lint:
    #!/usr/bin/env bash
    set -euo pipefail
    for pkg in {{ci_packages}}; do
        just lint-package "$pkg"
    done

lint-package pkg:
    #!/usr/bin/env bash
    set -euo pipefail
    package={{quote(pkg)}}
    if [ "$package" = "pi-ask-user-glimpse" ]; then
        npx @biomejs/biome check \
            packages/pi-ask-user-glimpse/index.ts \
            packages/pi-ask-user-glimpse/tool \
            packages/pi-ask-user-glimpse/shared \
            packages/pi-ask-user-glimpse/constants \
            packages/pi-ask-user-glimpse/types
    else
        npx @biomejs/biome check "packages/$package"
    fi

# Type-check all packages (fail fast).
typecheck:
    #!/usr/bin/env bash
    set -euo pipefail
    for pkg in packages/*/; do
        echo "Type-checking $pkg..."
        cd "$pkg"
        if node -e 'const p = require("./package.json"); process.exit(p.scripts?.typecheck ? 0 : 1)'; then
            npm run typecheck
        elif node -e 'const p = require("./package.json"); process.exit(p.scripts?.check ? 0 : 1)'; then
            npm run check
        else
            echo "  no typecheck script — skipping"
        fi
        cd - >/dev/null
    done

# Canonical CI entry points. GitHub Actions and Worktrunk call these exact recipes.
ci-shared:
    node --test scripts/ci-contract.test.mjs
    npm --prefix packages/pi-shared run typecheck

ci-package pkg:
    #!/usr/bin/env bash
    set -euo pipefail
    package={{quote(pkg)}}
    case " {{ci_packages}} " in
        *" $package "*) ;;
        *) echo "Unknown CI package: $package" >&2; exit 2 ;;
    esac

    just lint-package "$package"
    cd "packages/$package"

    has_script() {
        node -e 'const p = require("./package.json"); process.exit(p.scripts?.[process.argv[1]] ? 0 : 1)' "$1"
    }

    if has_script typecheck; then
        npm run typecheck
    elif has_script check; then
        npm run check
    else
        echo "No typecheck/check script for $package"
    fi

    if has_script test; then
        npm test
    elif [ -f test-integration.mjs ]; then
        node test-integration.mjs
    else
        echo "No tests for $package"
    fi

    if has_script test:e2e; then
        npm run test:e2e
    fi
    if has_script validate; then
        npm run validate
    fi

    npm publish --dry-run
    npm run pack-smoke --if-present

ci: ci-shared
    #!/usr/bin/env bash
    set -euo pipefail
    for pkg in {{ci_packages}}; do
        just ci-package "$pkg"
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
