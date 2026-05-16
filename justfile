# pi-bump task runner
# https://github.com/casey/just

default:
    @just --list

check:
    npm run check

test:
    node test-integration.mjs

dry-run:
    npm publish --dry-run

publish:
    npm publish

release version:
    git tag -a "v{{version}}" -m "Release v{{version}}"
    git push origin "v{{version}}"
    @echo "Tag v{{version}} pushed. GitHub Actions will publish to npm."
