# Documentation Architecture Plan

> Restructured documentation organization for pi-pkg-guard
> 
> **Date:** 2026-04-23  
> **Status:** Proposed - Pending Review

---

## Current State Analysis

### Existing Structure

```
docs/
├── UX_DESIGN_SPEC.md              # TUI zone architecture & menu design
└── en-US/
    ├── README.md                    # Language-specific overview
    ├── INSTALL.md                   # Installation instructions
    ├── USAGE.md                     # Usage guide
    └── CONTRIBUTING.md              # Development & contribution guide
```

### Problems with Current Structure

1. **Mixed Concerns:** Product documentation (USAGE.md) mixed with contributor docs (CONTRIBUTING.md)
2. **No Single Source of Truth:** User stories scattered across code comments
3. **No Traceability:** Implementation not linked to requirements
4. **Flat Structure:** No clear hierarchy for different user personas
5. **Duplication:** Features described in both README.md and USAGE.md
6. **Missing Epics:** No organized view by feature domain

---

## Proposed New Structure

```
docs/
├── README.md                          # [UPDATE] Overview + quick links to sections
├── ARCHITECTURE.md                    # [NEW] Technical architecture & design decisions
├── USER_STORIES.md                    # [NEW] Product requirements (exists - just created)
├── DOCUMENTATION_ARCHITECTURE.md      # [NEW] This file - docs meta-documentation
│
├── epics/                             # [NEW] Feature-domain organization
│   ├── epic-01-detection-prevention/  # [NEW] Orphan detection & npm guard
│   │   ├── README.md                  # [NEW] Epic overview
│   │   ├── user-stories.md            # [NEW] Stories 1.1, 1.2, 2.1
│   │   └── acceptance-criteria/       # [NEW] Gherkin .feature files
│   │       ├── startup-detection.feature
│   │       ├── npm-install-guard.feature
│   │       └── manual-scan.feature
│   │
│   ├── epic-02-package-management/    # [NEW] Sync, register, restore
│   │   ├── README.md
│   │   ├── user-stories.md            # [NEW] Story 2.2
│   │   └── acceptance-criteria/
│   │       └── selective-restore.feature
│   │
│   ├── epic-03-backup-recovery/       # [NEW] Local & Gist backup
│   │   ├── README.md
│   │   ├── user-stories.md            # [NEW] Stories 3.1, 3.2
│   │   └── acceptance-criteria/
│   │       ├── local-backup.feature
│   │       └── gist-backup.feature
│   │
│   ├── epic-04-configuration/         # [NEW] Settings, paths
│   │   ├── README.md
│   │   ├── user-stories.md            # [NEW] Stories 4.1, 4.2
│   │   └── acceptance-criteria/
│   │       ├── custom-backup-path.feature
│   │       └── config-persistence.feature
│   │
│   └── epic-05-user-experience/       # [NEW] UI/UX, i18n, help
│       ├── README.md
│       ├── user-stories.md            # [NEW] Stories 5.1, 5.2, 5.3
│       ├── acceptance-criteria/
│       │   ├── menu-interface.feature
│       │   ├── contextual-help.feature
│       │   └── internationalization.feature
│       └── UX_DESIGN_SPEC.md          # [MOVE] From docs/UX_DESIGN_SPEC.md
│
├── user-guides/                       # [NEW] Task-oriented guides
│   ├── README.md                      # [NEW] Guide index
│   ├── getting-started.md             # [NEW] Quick start tutorial
│   ├── installation.md                # [UPDATE] Merged from en-US/INSTALL.md
│   ├── usage.md                       # [UPDATE] Merged from en-US/USAGE.md
│   ├── backup-strategies.md           # [NEW] Best practices for backups
│   ├── multi-machine-setup.md         # [NEW] Using Gist across devices
│   └── troubleshooting.md             # [NEW] Common issues & solutions
│
├── reference/                         # [NEW] Technical reference
│   ├── README.md                      # [NEW] Reference index
│   ├── api.md                         # [NEW] Extension API documentation
│   ├── configuration.md               # [NEW] Config options reference
│   ├── security.md                    # [NEW] Security model & validations
│   └── i18n-guide.md                  # [NEW] Translation contributor guide
│
├── development/                       # [NEW] Contributor documentation
│   ├── README.md                      # [NEW] Contributor getting started
│   ├── setup.md                       # [NEW] Dev environment setup
│   ├── architecture-deep-dive.md      # [NEW] Code architecture
│   ├── testing.md                     # [NEW] Test writing guide
│   ├── contributing.md                # [UPDATE] From en-US/CONTRIBUTING.md
│   └── release-process.md             # [NEW] Release workflow
│
└── translations/                      # [NEW] i18n structure (future)
    ├── README.md                      # [NEW] Translation status
    └── template/                      # [NEW] Translation templates
        └── en-US-template.ts

# Archive (for historical docs)
docs/archive/
└── (empty - clean slate for new structure)
```

---

## Document Update vs Archive Decisions

### UPDATE (Keep & Enhance)

| Current Document | Action | Rationale |
|-----------------|--------|-----------|
| `docs/en-US/README.md` | **Merge** into `docs/README.md` | Single root overview, reduce duplication |
| `docs/en-US/INSTALL.md` | **Move** to `docs/user-guides/installation.md` | User task-oriented location |
| `docs/en-US/USAGE.md` | **Split** across guides | Content becomes task-oriented guides |
| `docs/en-US/CONTRIBUTING.md` | **Move** to `docs/development/contributing.md` | Clear contributor section |
| `docs/UX_DESIGN_SPEC.md` | **Move** to `docs/epics/epic-05-user-experience/UX_DESIGN_SPEC.md` | Belongs with UX epic |

### ARCHIVE (Move to `docs/archive/`)

| Current Document | Action | Rationale |
|-----------------|--------|-----------|
| None initially | Keep current structure working | Soft transition - new structure created alongside |

### DELETE (Not Needed in New Structure)

| Current Document | Action | Rationale |
|-----------------|--------|-----------|
| `docs/en-US/README.md` | **Delete after merge** | Merged into root README |

---

## Content Migration Matrix

### From `docs/en-US/README.md`

| Section | Destination | Notes |
|---------|-------------|-------|
| Overview | `docs/README.md` | Keep as intro |
| The Problem/Solution | `docs/README.md` | Keep as motivation |
| Key Features table | `docs/README.md` | Convert to quick-links |
| Quick Start | `docs/user-guides/getting-started.md` | Expand into tutorial |
| Next Steps | `docs/README.md` | Update links to new structure |

### From `docs/en-US/INSTALL.md`

| Section | Destination | Notes |
|---------|-------------|-------|
| Recommended: Via pi | `docs/user-guides/installation.md` | Keep |
| Alternative: Via npm | `docs/user-guides/installation.md` | Keep with warning about orphans |
| Development: Manual/Symlink | `docs/development/setup.md` | Move to dev section |
| Prerequisites | `docs/user-guides/installation.md` | Keep |
| Verification | `docs/user-guides/getting-started.md` | Move to quick start |
| Uninstallation | `docs/user-guides/installation.md` | Keep |
| Troubleshooting | `docs/user-guides/troubleshooting.md` | Move to dedicated guide |

### From `docs/en-US/USAGE.md`

| Section | Destination | Notes |
|---------|-------------|-------|
| Commands table | `docs/user-guides/usage.md` | Simplify |
| Passive Features | `docs/epics/epic-01-detection-prevention/user-stories.md` | Link to stories |
| Backup & Restore | `docs/user-guides/backup-strategies.md` | Expand into guide |
| Understanding Orphaned Packages | `docs/reference/configuration.md` | Move to reference |
| Security Features | `docs/reference/security.md` | Move to security doc |
| Best Practices | `docs/user-guides/getting-started.md` | Integrate into tutorial |

### From `docs/en-US/CONTRIBUTING.md`

| Section | Destination | Notes |
|---------|-------------|-------|
| Development Setup | `docs/development/setup.md` | Keep |
| Code Standards | `docs/development/contributing.md` | Keep |
| Testing | `docs/development/testing.md` | Expand |
| Type Guards section | `docs/development/testing.md` | Keep |
| Translating | `docs/reference/i18n-guide.md` | Move to i18n guide |
| Release Process | `docs/development/release-process.md` | Expand from AGENTS.md |

---

## New Document Specifications

### Root README.md

**Purpose:** Landing page for all users

**Sections:**
1. Project elevator pitch (1-2 sentences)
2. Quick demo GIF/screenshot
3. Key Features (5 bullets)
4. Quick Start (3 commands)
5. Documentation Map (decision tree)
   - New User? → Getting Started
   - Setting up backup? → Backup Strategies
   - Contributing? → Development docs
   - Need API details? → Reference
6. Badges, License, Contributing link

### Epic Organization

Each epic directory contains:

```
epic-NN-name/
├── README.md              # Epic overview, goals, scope
├── user-stories.md        # Stories specific to this epic
├── architecture.md        # Technical design for this epic
└── acceptance-criteria/   # Gherkin .feature files
    └── *.feature
```

**Epic README Template:**

```markdown
# Epic N: Epic Name

## Goal
One-sentence epic objective

## User Stories
- [Story N.1](user-stories.md#story-n1-name)
- [Story N.2](user-stories.md#story-n2-name)

## Technical Scope
What components are involved

## Dependencies
What other epics/stories this depends on

## Completion Criteria
When is this epic "done"
```

### User Guides

Task-oriented, not feature-oriented:

- **Getting Started:** Tutorial from zero to first successful scan
- **Installation:** All installation methods with pros/cons
- **Usage:** Common workflows (scan, backup, restore)
- **Backup Strategies:** Choosing local vs Gist, frequency recommendations
- **Multi-Machine Setup:** Step-by-step Gist workflow
- **Troubleshooting:** FAQ, common errors, debugging

### Reference

Lookup documentation for developers:

- **API:** Extension API, event handlers, commands
- **Configuration:** All settings with defaults
- **Security:** Threat model, validations, boundaries
- **i18n Guide:** Adding new languages, ICU MessageFormat reference

### Development

Contributor-focused:

- **Setup:** Clone, install, dev mode, IDE setup
- **Architecture:** Code organization, data flow, design patterns
- **Testing:** Writing tests, running tests, coverage
- **Contributing:** PR process, code review, standards
- **Release Process:** Version bump, tagging, CI/CD

---

## Traceability Mapping

### Story → Implementation Links

All stories in `USER_STORIES.md` include a Traceability table:

```markdown
#### Traceability
| Component | File | Function/Line |
|-----------|------|---------------|
| Detection Logic | `extensions/index.ts` | `analyzePackages()` (L330-347) |
```

### Epic → Test Mapping

Each epic links to relevant test files:

```markdown
## Test Coverage
- Unit tests: `test/analysis.test.ts`
- Integration: `test/gist.test.ts`
- Type guards: `test/type-guards.test.ts`
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create new directory structure
- [ ] Write `docs/README.md`
- [ ] Write `docs/USER_STORIES.md` (✅ Done)
- [ ] Write `docs/DOCUMENTATION_ARCHITECTURE.md` (✅ Done)

### Phase 2: User Guides (Week 2)
- [ ] Write `docs/user-guides/getting-started.md`
- [ ] Move & update `docs/user-guides/installation.md`
- [ ] Write `docs/user-guides/usage.md`
- [ ] Write `docs/user-guides/troubleshooting.md`

### Phase 3: Reference (Week 3)
- [ ] Write `docs/reference/api.md`
- [ ] Write `docs/reference/configuration.md`
- [ ] Write `docs/reference/security.md`
- [ ] Write `docs/reference/i18n-guide.md`

### Phase 4: Development (Week 4)
- [ ] Write `docs/development/setup.md`
- [ ] Move & update `docs/development/contributing.md`
- [ ] Write `docs/development/testing.md`
- [ ] Write `docs/development/release-process.md`

### Phase 5: Epics (Week 5)
- [ ] Create epic directories
- [ ] Write epic READMEs
- [ ] Extract Gherkin feature files
- [ ] Move `UX_DESIGN_SPEC.md` to UX epic

### Phase 6: Cleanup (Week 6)
- [ ] Archive old en-US/ directory
- [ ] Update root README links
- [ ] Create redirects/notes for moved content
- [ ] Verify all links work

---

## Decision Rationale

### Why Epics Over Flat Structure?

1. **Greenfield Thinking:** Treat implementation as requirements discovery
2. **Traceability:** Clear path from story → implementation → test
3. **Scoping:** Easier to understand feature boundaries
4. **Prioritization:** Epics can be prioritized independently

### Why Separate User Guides from Reference?

| Guide Type | Audience | Purpose | Structure |
|------------|----------|---------|-----------|
| User Guides | End users | How to accomplish tasks | Task-oriented |
| Reference | Power users | Lookup detailed info | Feature-oriented |
| Development | Contributors | How to modify code | Component-oriented |

### Why Gherkin Feature Files?

- **Executable Specs:** Can be used for BDD testing in future
- **Clarity:** Given/When/Then is unambiguous
- **Stakeholder Communication:** Non-technical readable

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Docs organization clarity | Mixed | Clear by persona |
| Story traceability | None | 100% linked |
| User guide coverage | 3 docs | 6 comprehensive guides |
| Contributor onboarding | Single file | Multi-path guidance |
| Translation structure | Flat | Template-ready |

---

## Open Questions

1. Should we maintain multiple language translations in docs/ or separate repo?
2. Should Gherkin files be executable tests or documentation only?
3. Do we need API documentation generated from TypeScript types?
4. Should we include architecture decision records (ADRs)?

---

*Document Architecture Plan - v1.0*
