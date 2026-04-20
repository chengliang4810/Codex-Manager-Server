# Sub2api-Style Online Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sub2api-style online upgrade support that downloads GitHub Release binaries, replaces the running Linux binaries, and restarts through the container restart policy.

**Architecture:** `codexmanager-web` remains the primary process and exposes `/api/system/*` endpoints for update check, apply, rollback, and restart. The updater downloads `web` and sibling `service` release archives, verifies checksums, replaces both binaries atomically, and then exits so Docker can restart the single-container runtime.

**Tech Stack:** Rust (`axum`, `tokio`, `reqwest`, `zip`, `sha2`), Next.js 16, Docker, GitHub Releases, GHCR.

---

### Task 1: Stabilize Backend Updater Build

**Files:**
- Modify: `crates/web/src/updater.rs`
- Modify: `crates/web/src/main.rs`
- Test: `crates/web/src/updater.rs`

- [ ] **Step 1: Add or extend updater unit tests for release asset and version handling**
- [ ] **Step 2: Run `cargo test -p codexmanager-web` and confirm the current updater build fails**
- [ ] **Step 3: Fix version source usage, blocking lock ownership, and zip entry extraction with the minimal code change**
- [ ] **Step 4: Run `cargo test -p codexmanager-web` again and confirm the updater path passes**

### Task 2: Restore Frontend Update Actions

**Files:**
- Modify: `apps/src/lib/api/app-client.ts`
- Modify: `apps/src/lib/api/app-updates.ts`
- Modify: `apps/src/app/settings/page.tsx`
- Test: `tests/app-updates.test.mjs`

- [ ] **Step 1: Add or keep focused tests around update result normalization and client fallback behavior**
- [ ] **Step 2: Run `pnpm exec node --test tests/app-updates.test.mjs tests/dev-server-proxy.test.mjs` and confirm current failures or coverage gaps**
- [ ] **Step 3: Fix the frontend update client imports and dialog action flow with the smallest change set**
- [ ] **Step 4: Run `pnpm run build` and targeted Node tests to confirm the settings page compiles**

### Task 3: Validate Single-Image Runtime Delivery

**Files:**
- Modify: `docker/Dockerfile.allinone`
- Modify: `docker/Dockerfile.allinone.release`
- Modify: `docker/docker-compose.single.yml`
- Modify: `docker/docker-compose.single.release.yml`
- Modify: `.github/workflows/release-all.yml`
- Modify: `.github/actions/publish-github-release/action.yml`

- [ ] **Step 1: Verify the all-in-one image contains both binaries and the entrypoint**
- [ ] **Step 2: Verify release workflow staging includes single-image compose, checksums, and all-in-one image publishing**
- [ ] **Step 3: Build the all-in-one image locally and confirm the container starts with restart-policy-compatible runtime layout**
- [ ] **Step 4: Record any follow-up doc changes only if required by the verified runtime behavior**
