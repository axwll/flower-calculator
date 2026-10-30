# Decisions

Dated record of changes to decisions in [PLAN.md](PLAN.md).

## 2026-10-30: Phase 0 finished by the agent

The plan makes Phase 0 the owner's job. The owner did the scaffold and asked the agent to finish what was left. The rule against the agent running git write commands still stands.

## 2026-10-30: Node 24, pinned in `.nvmrc`

The scaffold requires Node `^22.18.0 || >=24.12.0`, and Vitest crashes on 22.14. Node 24 matches `@tsconfig/node24`. The deploy workflow reads the same `.nvmrc`.

## 2026-10-30: Added `@vitest/coverage-v8`

Not listed in section 3. Vitest needs a coverage provider for the required `test:coverage` script and its 90% engine threshold.

## 2026-10-30: `typecheck` runs `vue-tsc --build`, not `vue-tsc --noEmit`

The root `tsconfig.json` only holds project references, so `--noEmit` from the root would check nothing. `--build` checks every referenced project.

## 2026-10-30: `lint` runs oxlint as well as ESLint

The scaffold came with both. Both run with zero warnings allowed, and neither uses `--fix`, so `check` never changes files.

## 2026-10-30: Prettier skips `docs/`

Keeps the plan and other docs exactly as written. `format:check` covers everything else.
