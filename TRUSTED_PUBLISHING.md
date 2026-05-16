# Trusted Publishing Setup Guide

This monorepo uses **npm Trusted Publishing** (OIDC) to publish packages without storing `NPM_TOKEN` secrets.

## What You Need to Do (One-Time per Package)

For each package on npm, configure it to accept publishes from this GitHub repository.

### Step 1: Log into npmjs.com

Go to [npmjs.com](https://www.npmjs.com) and sign in as the package owner (`alexleekt`).

### Step 2: Open Package Settings

Navigate to each package and click **"Settings"** → **"Publish"** tab:

- [`@alexleekt/pi-bump`](https://www.npmjs.com/package/@alexleekt/pi-bump)
- [`@alexleekt/pi-pkg-guard`](https://www.npmjs.com/package/@alexleekt/pi-pkg-guard)
- [`@alexleekt/pi-ask-user-glimpse`](https://www.npmjs.com/package/@alexleekt/pi-ask-user-glimpse)
- [`@alexleekt/pi-shared`](https://www.npmjs.com/package/@alexleekt/pi-shared)

### Step 3: Add GitHub Repository

Under **"Link to a GitHub repository for trusted publishing"**:

| Field | Value |
|---|---|
| **Repository** | `alexleekt/pi-extensions` |
| **Workflow** | `.github/workflows/publish.yml` |
| **Environment** | *(leave blank / "Production")* |

Click **"Link repository"**.

### Step 4: Verify

After linking, a green checkmark should appear next to the linked repository.

## How It Works

When you run:

```bash
just release pi-bump 0.3.0
```

1. `npm version` bumps the version
2. Git commit + tag (`@alexleekt/pi-bump@0.3.0`) + push
3. GitHub Actions triggers `publish.yml`
4. `setup-node` with `registry-url` enables npm OIDC auth
5. `npm publish --provenance` uses the GitHub-issued OIDC token
6. npm verifies the token against the linked repository
7. Package publishes with provenance attestation

## Provenance

Published packages will show a **green "Provenance"** badge on npm, proving they were built and published by GitHub Actions in this repository.

## First-Time Package Bootstrap

**Trusted Publishing can only be configured for packages that already exist on npm.**

If a package has never been published (e.g. `@alexleekt/pi-shared`), the workflow will fail with `ENEEDAUTH` because npm has no package to link the repository to.

### Bootstrap Steps

1. **Publish manually from your machine:**
   ```bash
   cd packages/<pkg>
   npm login
   npm publish --access public
   ```

2. **Configure Trusted Publishing on npmjs.com** (Step 2–3 above)

3. **Future releases will use Trusted Publishing automatically**

### Alternative: Add NPM_TOKEN Secret

If you prefer to bootstrap from CI, add a `NPM_TOKEN` secret to the repo settings. The workflow will use it for first-time publishes and fall back to Trusted Publishing for subsequent releases.

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ENEEDAUTH` | Package not linked to repo | Complete Step 3 above |
| `E403` | Wrong workflow file path | Ensure `.github/workflows/publish.yml` is exact |
| `E404` | Package doesn't exist | Bootstrap via manual publish or NPM_TOKEN |

## Fallback: NPM_TOKEN

If Trusted Publishing fails or a package is owned by a different npm account, add a `NPM_TOKEN` secret to the repo settings. The workflow will auto-detect it and use token-based auth instead.
