# Testing Guide

> Test writing guide for pi-pkg-guard

---

## Test Framework

Uses Node.js built-in test runner (`node:test`) with `node:assert`.

```bash
npm test
# or
just test
```

---

## Test Structure

```typescript
import { test } from "node:test";
import assert from "node:assert";
import { functionToTest } from "../extensions/index.js";

test("should do X when Y", () => {
  // Arrange
  const input = ...;
  
  // Act
  const result = functionToTest(input);
  
  // Assert
  assert.strictEqual(result, expected);
});
```

---

## Type Guard Testing

Type guards need comprehensive coverage:

```typescript
test("isPiSettings should return true for valid settings", () => {
  assert.strictEqual(
    isPiSettings({ packages: ["npm:pi-foo"] }),
    true
  );
});

test("isPiSettings should return false for null", () => {
  assert.strictEqual(isPiSettings(null), false);
});

test("isPiSettings should return false for missing packages", () => {
  assert.strictEqual(isPiSettings({}), false);
});

test("isPiSettings should return false for non-array packages", () => {
  assert.strictEqual(
    isPiSettings({ packages: "not-array" }),
    false
  );
});
```

---

## Pattern Testing

Test regex patterns with various inputs:

```typescript
test("should detect npm install -g pattern", () => {
  const pattern = /npm\s+(install|i)\s+.*(-g|--global)/;
  
  assert.match("npm install -g pi-foo", pattern);
  assert.match("npm i -g pi-bar", pattern);
  assert.match("npm install pi-baz -g", pattern);
  
  // Negative cases
  assert.doesNotMatch("npm install pi-foo", pattern); // No -g
  assert.doesNotMatch("npm install -g typescript", pattern); // No pi-
});
```

---

## Async Testing

```typescript
test("should fetch npm packages", async () => {
  const packages = await getNpmGlobalPackages();
  
  assert.ok(Array.isArray(packages));
  assert.ok(packages.length > 0);
});
```

---

## Test Categories

| File | Tests |
|------|-------|
| `analysis.test.ts` | Package analysis, unregistered detection |
| `backup-migration.test.ts` | Legacy backup migration to current schema |
| `gist.test.ts` | Gist utilities, ID validation, URL extraction |
| `gist-operations.test.ts` | Gist sync/create/delete/get operations |
| `keyword-detection.test.ts` | Keyword-based package detection |
| `menu-navigation.test.ts` | Menu structure, routing, contextual labels, subcommands |
| `npm-guard.test.ts` | npm install guard pattern matching |
| `package-snapshot-validation.test.ts` | Backup schema validation |
| `regex.test.ts` | Pattern matching, command detection |
| `restore-workflow.test.ts` | Restore filtering and batch logic |
| `session-start.test.ts` | Startup detection behavior |
| `tui-fixes.test.ts` | Status lifecycle and notification patterns |
| `type-guards.test.ts` | Runtime type validation |

---

## Best Practices

1. **Test behavior, not implementation**
2. **One assertion per test** (or closely related assertions)
3. **Descriptive test names** - "should X when Y"
4. **Edge cases** - null, undefined, empty, invalid
5. **Cleanup** - Use `before`/`after` hooks if needed

---

## Running Specific Tests

```bash
# Single test file
node --test test/gist.test.ts

# With tsx
npx tsx --test test/gist.test.ts
```

---

*[← Back to Development](./README.md)*
