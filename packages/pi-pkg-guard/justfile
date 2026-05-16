# pi-pkg-guard task runner
# https://github.com/casey/just

# Default recipe - show available tasks
default:
    @just --list

# Development mode toggle - prevent duplicate extension loading
# =============================================================================

# Check current installation status
dev-status:
    #!/usr/bin/env bash
    echo "=== pi-pkg-guard Installation Status ==="
    echo ""
    
    # Check npm package
    if pi package list 2>/dev/null | grep -q "pi-pkg-guard"; then
        echo "📦 npm package: INSTALLED"
        pi package list 2>/dev/null | grep "pi-pkg-guard" | head -1
    else
        echo "📦 npm package: NOT installed"
    fi
    
    # Check symlink
    if [ -L "$HOME/.pi/agent/extensions/pi-pkg-guard" ]; then
        SYMLINK_TARGET=$(readlink "$HOME/.pi/agent/extensions/pi-pkg-guard")
        echo "🔗 dev symlink: $SYMLINK_TARGET"
    else
        echo "🔗 dev symlink: NOT present"
    fi
    
    echo ""
    echo "🎯 Recommendation:"
    if pi package list 2>/dev/null | grep -q "pi-pkg-guard" && [ -L "$HOME/.pi/agent/extensions/pi-pkg-guard" ]; then
        echo "   ⚠️  DUPLICATE DETECTED - Run 'just dev-mode' or 'just user-mode'"
    elif [ -L "$HOME/.pi/agent/extensions/pi-pkg-guard" ]; then
        echo "   ✅ Dev mode active - good for development"
    elif pi package list 2>/dev/null | grep -q "pi-pkg-guard"; then
        echo "   ✅ User mode active - using published version"
    else
        echo "   ❌ Not installed - run 'just dev-mode' or 'pi package add pi-pkg-guard'"
    fi

# Switch to development mode (symlink only, remove npm package)
dev-mode:
    #!/usr/bin/env bash
    set -e
    echo "🔄 Switching to DEV mode..."
    
    # Remove npm package if present
    if pi package list 2>/dev/null | grep -q "pi-pkg-guard"; then
        echo "📦 Removing npm:pi-pkg-guard from pi packages..."
        pi package remove pi-pkg-guard || true
    fi
    
    # Ensure symlink exists
    EXT_DIR="$HOME/.pi/agent/extensions/pi-pkg-guard"
    REPO_DIR="$HOME/git/pi-pkg-guard"
    
    if [ ! -L "$EXT_DIR" ]; then
        echo "🔗 Creating symlink $EXT_DIR -> $REPO_DIR"
        ln -s "$REPO_DIR" "$EXT_DIR"
    else
        echo "🔗 Symlink already exists"
    fi
    
    echo ""
    echo "✅ Dev mode enabled!"
    echo "   - npm package removed"
    echo "   - dev symlink active"
    echo "   - Edit code in $REPO_DIR and changes are live immediately"

# Switch to user mode (npm package only, remove symlink)
user-mode:
    #!/usr/bin/env bash
    set -e
    echo "🔄 Switching to USER mode..."
    
    # Remove symlink if present
    EXT_DIR="$HOME/.pi/agent/extensions/pi-pkg-guard"
    if [ -L "$EXT_DIR" ]; then
        echo "🗑️  Removing dev symlink..."
        rm "$EXT_DIR"
    fi
    
    # Add npm package if not present
    if ! pi package list 2>/dev/null | grep -q "pi-pkg-guard"; then
        echo "📦 Installing npm:pi-pkg-guard..."
        pi package add pi-pkg-guard
    else
        echo "📦 npm:pi-pkg-guard already installed"
    fi
    
    echo ""
    echo "✅ User mode enabled!"
    echo "   - dev symlink removed"
    echo "   - using published npm version"
    echo "   - Run 'pi package update pi-pkg-guard' to get latest"

# Run all checks (format, lint, test, typecheck)
check: format lint test typecheck lint-actions
    @echo "✅ All checks passed!"

# Check code with biome (no fixes)
check-only:
    npx @biomejs/biome check .

# Fix all auto-fixable biome issues
fix:
    npx @biomejs/biome check --write .

# Format code with biome
format:
    npx @biomejs/biome format --write .

# Lint code with biome
lint:
    npx @biomejs/biome lint .

# Lint GitHub Actions workflows (requires actionlint: brew install actionlint)
lint-actions:
    #!/usr/bin/env bash
    if ! command -v actionlint >/dev/null 2>&1; then
        echo "⚠️  actionlint not installed. Install with: brew install actionlint"
        exit 1
    fi
    actionlint .github/workflows/*.yml

# Run all tests
test:
    npx tsx --test test/**/*.test.ts

# Run tests in watch mode
test-watch:
    npx tsx --test --watch test/**/*.test.ts

# TypeScript type checking
typecheck:
    npx tsc --noEmit --skipLibCheck

# Clean build artifacts and dependencies
clean:
    rm -rf node_modules dist coverage *.log

# Install dependencies
install:
    npm install

# Dry run npm publish
dry-run:
    npm publish --dry-run

# Publish to npm (requires auth)
publish:
    npm publish --access public

# CI recipe - runs in CI/CD pipelines (no watch mode)
ci: check-only test typecheck lint-actions


# Release a new version (triggers GitHub Actions publish)
# 
# This command first checks conventional commits since the last tag to ensure
# the version in package.json matches the semantic version bump needed.
# Abort with instructions if semantic release should be run first.
#
# Usage: just release [VERSION]
# Examples:
#   just release 0.3.0              # Explicit version
#   just release                    # Auto-detect from package.json
#   RELEASE_FORCE=1 just release    # Skip semantic version check
#
release version="":
    #!/usr/bin/env bash
    set -e
    
    # Helper: compare semver versions (returns 0 if $1 >= $2)
    version_ge() {
        [ "$1" = "$2" ] && return 0
        local IFS=.
        local i ver1=($1) ver2=($2)
        for ((i=0; i<${#ver1[@]}; i++)); do
            local v1=${ver1[i]:-0}
            local v2=${ver2[i]:-0}
            if ((10#$v1 > 10#$v2)); then return 0; fi
            if ((10#$v1 < 10#$v2)); then return 1; fi
        done
        return 0
    }
    
    # Get current package.json version
    PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    if [ -z "$PKG_VERSION" ] || [ "$PKG_VERSION" = "undefined" ]; then
        echo "❌ Error: Could not read version from package.json"
        exit 1
    fi
    
    # Detect semantic version bump needed from conventional commits
    echo "🔍 Checking conventional commits for semantic version bump..."
    
    # Get the last tag
    LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -z "$LAST_TAG" ]; then
        echo "⚠️  No previous tag found. Assuming this is the first release."
        SUGGESTED_BUMP="none"
    else
        # Remove 'v' prefix if present for comparison
        LAST_VERSION=${LAST_TAG#v}
        
        # Get commits since last tag
        COMMITS=$(git log "$LAST_TAG"..HEAD --pretty=format:"%s" 2>/dev/null || echo "")
        
        if [ -z "$COMMITS" ]; then
            echo "⚠️  No commits since $LAST_TAG"
            SUGGESTED_BUMP="none"
        else
            # Analyze commit types
            HAS_BREAKING=$(echo "$COMMITS" | grep -E "^(feat|fix|chore|refactor|docs|style|test|perf)!:|BREAKING CHANGE:" || true)
            HAS_FEAT=$(echo "$COMMITS" | grep -E "^feat(\([^)]*\))?:" || true)
            HAS_FIX=$(echo "$COMMITS" | grep -E "^fix(\([^)]*\))?:" || true)
            
            # Parse current version
            IFS=. read -r MAJOR MINOR PATCH <<< "$LAST_VERSION"
            MAJOR=${MAJOR:-0}
            MINOR=${MINOR:-0}
            PATCH=${PATCH:-0}
            
            if [ -n "$HAS_BREAKING" ]; then
                SUGGESTED_VERSION="$((MAJOR + 1)).0.0"
                SUGGESTED_BUMP="major"
                BUMP_REASON="breaking changes detected"
            elif [ -n "$HAS_FEAT" ]; then
                SUGGESTED_VERSION="$MAJOR.$((MINOR + 1)).0"
                SUGGESTED_BUMP="minor"
                BUMP_REASON="new features detected"
            elif [ -n "$HAS_FIX" ]; then
                SUGGESTED_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
                SUGGESTED_BUMP="patch"
                BUMP_REASON="bug fixes detected"
            else
                SUGGESTED_VERSION="$LAST_VERSION"
                SUGGESTED_BUMP="none"
                BUMP_REASON="no version-bumping commits"
            fi
        fi
    fi
    
    # Check if semantic release is needed (can be skipped with RELEASE_FORCE=1)
    if [ -z "$RELEASE_FORCE" ] && [ "$SUGGESTED_BUMP" != "none" ]; then
        if [ "$PKG_VERSION" != "$SUGGESTED_VERSION" ]; then
            echo ""
            echo "❌ Semantic version mismatch detected!"
            echo ""
            echo "   Last tag:     $LAST_TAG ($LAST_VERSION)"
            echo "   Package.json: v$PKG_VERSION"
            echo "   Should be:    v$SUGGESTED_VERSION ($BUMP_REASON)"
            echo ""
            echo "   Run semantic release first:"
            echo "      - Update package.json version to $SUGGESTED_VERSION"
            echo "      - Update CHANGELOG.md"
            echo "      - Commit with: chore(release): bump version to $SUGGESTED_VERSION"
            echo ""
            echo "   Or skip this check with: RELEASE_FORCE=1 just release"
            exit 1
        fi
        echo "✅ Version bump matches conventional commits ($BUMP_REASON → v$SUGGESTED_VERSION)"
    else
        echo "ℹ️  No version bump detected from commits"
    fi
    
    # Auto-detect version from package.json if not provided
    if [ -z "{{version}}" ]; then
        VERSION=$PKG_VERSION
        echo "📦 Using version from package.json: v$VERSION"
    else
        VERSION="{{version}}"
        echo "📦 Using specified version: v$VERSION"
    fi
    
    # Check if tag already exists
    if git rev-parse "v$VERSION" >/dev/null 2>&1; then
        echo "❌ Error: Tag v$VERSION already exists"
        echo "   Use: git tag -d v$VERSION  # to delete locally"
        echo "   Then: git push --delete origin v$VERSION  # to delete remotely"
        exit 1
    fi
    
    
    echo "🏷️  Creating release v$VERSION..."
    git tag -a "v$VERSION" -m "Release v$VERSION"
    git push origin "v$VERSION"
    echo ""
    echo "✅ Tag v$VERSION pushed!"
    echo ""
    echo "GitHub Actions will now automatically:"
    echo "  1. ✅ Run all checks (biome, tests, typecheck)"
    echo "  2. ✅ Publish to npm with provenance"
    echo "  3. ✅ Create GitHub Release with auto-generated notes"
    echo ""
    echo "Monitor progress at: https://github.com/earendil-works/pi-mono/actions"

# Alias for release (backward compatibility)
# GitHub Releases are now created automatically by the workflow
release-notes version="":
    @just release {{version}}
    @echo ""
    @echo "ℹ️  Note: release-notes is now an alias for 'just release'"
    @echo "   GitHub Releases are created automatically by the workflow."

# Setup git hooks for pre-commit/pre-push checks
setup-hooks:
    #!/usr/bin/env bash
    set -e
    echo "🔧 Installing git hooks..."
    cp .githooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "✅ pre-commit hook installed (runs: just ci)"
    echo ""
    cp .githooks/pre-push .git/hooks/pre-push
    chmod +x .git/hooks/pre-push
    echo "✅ pre-push hook installed (runs: just check)"
    echo ""
    echo "Hooks are now active! To disable temporarily, use --no-verify flag:"
