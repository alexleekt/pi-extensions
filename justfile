# Pi Extensions Monorepo Tasks

_default:
    just --list

# Format all packages
fmt:
    npx @biomejs/biome format --write .

# Lint all packages
lint:
    npx @biomejs/biome check .

# Type-check all packages
check:
    for pkg in packages/*/; do \
        echo "Checking $pkg..."; \
        (cd "$pkg" && npm run check); \
    done

# Publish a package (usage: just publish pi-bump)
publish pkg:
    cd packages/{{pkg}} && npm publish --access public
