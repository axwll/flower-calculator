# Phase 1 brief: Engine

Status: **built, awaiting owner review.** The data questions below are still open, and fixtures use their fallbacks.

Goal: a pure, deterministic `allocate()` in `engine/`, with no UI, DOM, network or storage. See [PLAN.md](../PLAN.md) sections 5 and 6.

Baseline on 2026-10-30: commit `6380e71`, clean tree, live site serving, `npm run check` and `npm run test:coverage` both passing on Node 24.

## Files

```
engine/
  types.ts         Domain types (section 5) and result types
  money.ts         Pounds <-> pence, formatter
  expand.ts        Step 1: lines, equal split, floating stems
  aggregate.ts     Step 2
  prices.ts        Current-price resolution, staleness
  suppliers.ts     Step 3
  floating.ts      Step 4
  bunches.ts       Step 5
  leftovers.ts     Step 6
  rollups.ts       Step 8
  placements.ts    Step 7
  allocate.ts      Runs the steps in order
  index.ts         Public exports
  *.test.ts        Tests beside each module
  testkit/         Test-only: fast-check arbitraries, brute-force solver, fixture loader
fixtures/
  catalogue.json   Flowers, suppliers, designs, prices
  bridal.json      Bridal section
  reception.json   Reception section
  edge-cases.json  Deliberate cases from Appendix A, including Small/Medium/Large placeholders
```

Also touched: `eslint.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.vitest.json`, a new `tsconfig.engine.json`, `vitest.config.ts`, `docs/DECISIONS.md`.

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first, implement, `npm run check` green, then the next one.

### 1. Types, money, boundary rule

- All section 5 types are defined, with no `any`. `purchase` and `PurchaseSnapshot` wait for Phase 7, when their contents are designed.
- `parsePounds(text)` returns integer pence or `null`, with no floating-point maths. It accepts `12`, `12.5`, `12.50`, `.50`, `£12.50` and `1,250.00`. It rejects empty text, letters, negatives, a third decimal place and `12,50`.
- `formatPence(pence)` uses the single `en-GB` / `GBP` formatter.
- ESLint fails if `engine/` imports `vue`, `pinia`, `dexie`, or anything in `app/` or `api/`, or uses browser globals such as `window`, `document` or `localStorage`.
- ESLint fails if `app/` or non-test `engine/` code imports from `fixtures/`.
- `engine/` type checks through its own `tsconfig.engine.json` with no DOM library, so DOM use is also a type error.

**Tests:** parsing table (valid, invalid, values floats get wrong such as `19.99` and `1.15`), round trip for all pence from 0 to 9,999, formatter output. Lint rules are confirmed by a temporary violating file, as in Phase 0.

### 2. Expand and equal split (Step 1)

- Named lines give `stemsPerUnit × quantity` to that flower.
- Role lines split the line total: `floor(total / k)` each, with `total mod k` floating.
- `k` excludes the design's `excludedFlowerIds`.
- `k = 0` emits a warning and records the stems as unassigned.
- Disabled designs contribute nothing. Quantity 0 gives no stems and no warning.

**Tests:** the plan's example (7 × 5 across 3 flowers is 35 stems: 11 each plus 2 floating), even division, `total < k`, exclusions, `k = 0`, disabled designs, two role lines in one recipe.

### 3. Aggregation (Step 2)

- Stems are summed per flower across all roles and designs, including a flower used by both a named line and a role line.

**Tests:** multi-role flower, flower in several designs, stable ordering.

### 4. Current price and supplier choice (Step 3)

- Current price is the newest active report whose offer has not ended. An offer still applies at exactly `offerEndsAt`. Voided reports are ignored.
- An ended offer or voided report falls back to the previous report.
- Cheapest supplier is chosen on actual cost to cover the stems, not unit price.
- Stale prices do not win if a non-stale price exists. If only stale prices exist, the newest is used and flagged. Stale cheaper options are returned as flagged alternatives.
- Overrides win. Ties break by supplier id.
- No price or no bunch size means **needs data**: stems counted, cost excluded, warning emitted.

**Tests:** each rule above, plus a case where the lowest unit price is not the lowest actual cost, amber and red boundaries, same timestamps.

### 5. Floating stems (Step 4)

- Each floating stem goes to a distinct eligible flower on its line, so the strict split holds.
- Priority: flower with spare stems (most spare first), foraged, stem-sold, then bunch (lowest added cost, smallest bunch, stable order).
- Spare stems are tracked as stems are placed.
- After placement, the supplier choice is re-checked once. A flip is applied and noted, and stems are not placed again.

**Tests:** each priority level, spare tracking across lines, the single-pass flip, brute-force comparison against spare stems then cost on small random cases.

**Approach:** start with the greedy rule. If brute force finds a better outcome, use exhaustive search for small instances (the plan's limit of 12 floating stems, capped by number of combinations so it stays fast), and record any remaining gap in `DECISIONS.md`.

### 6. Bunches, spare stems, cost (Step 5)

- `bunch`, `stem` and `foraged` follow the Step 5 table.
- The thin-bunch rule matches the plan's examples: bunch of 48 warns at 7 or fewer, 20 at 3 or fewer, 10 at 1.
- `trackLeftovers: false` flowers get no thin-bunch warning.
- Foraged flowers appear on the gather list at cost 0.

**Tests:** all three modes, exact bunch multiples, each thin-bunch boundary (at and one over), a ticked flower that ends up with 0 stems.

### 7. Leftover pool and rollups (Steps 6 and 8)

- The pool reports spare stems per flower and `spare ÷ quantity` for information only.
- Order list is grouped by supplier, with subtotals and a grand total.
- Cost per design spreads spare-stem cost across designs and excludes the pool.
- If the plan is over `targetBudgetPence`, the top three cost drivers by flower and by design are returned.

**Tests:** pool figures, subtotals summing to the grand total, design costs summing to the total, budget at, under and over target.

### 8. Per-placement dealing (Step 7)

- Stems are dealt round-robin. Each placement gets exactly `stemsPerUnit`, and each flower differs by at most 1 between placements.
- Identical counts are grouped into ranges, numbered from 1.

**Tests:** the plan's scabious-style example, quantity 1, a flower with fewer stems than placements, wrapped ranges that are not adjacent.

### 9. Fixtures, golden tests, property tests

- Fixtures from Appendix A, with made-up names. Uncertain values carry a `notes` field. Placeholder recipes are marked `placeholder: true`.
- Every deliberate case from the Appendix A fixture rules is exercised.
- All 7 invariants pass as `fast-check` property tests.
- Engine coverage is at least 90% for lines and branches.

## Engine shape

The plan's signature is described as rough. `allocate` also needs flowers (for `soldAs`) and designs (for `isLeftoverPool`), and settings are already in the plan, so the signature will be:

```ts
allocate({ plan, flowers, designs, prices, now }): AllocationResult
```

Warnings are typed codes with data, not sentences, so the wording stays in the UI and can use her vocabulary. Nothing is called "true waste".

## Decisions needing your input

These come from cross-checking Appendix A. The first three stop the golden tests being meaningful, so they need answers before feature 9. Features 1 to 8 are not blocked.

| # | Question | If you have no answer |
| --- | --- | --- |
| 1 | **Scabious:** the paper total of 47 is 5 + 35 + 3 + 2 + 2. Bridal and bridesmaids give 40, leaving 7 for groom (1), buttonholes (4) and corsages (2). The 3 + 2 + 2 doesn't fit those quantities, because 4 buttonholes can't total 2 or 3 at a whole number each, but 1 stem each would give 7. What are the per-placement counts? | Groom 1, buttonholes 1, corsages 1 (total 47), noted as inferred |
| 2 | **Reception recipes:** pumpkins (20 stems) and the white posey have no flowers listed, and focal, secondary and filler have no palette. Which flowers go where? Is the posey's 20 per placement or in total? | Use role lines and an invented palette, marked as made up |
| 3 | **Prices:** Appendix A has none, and cost tests need them. Are invented round-number prices and supplier names acceptable? | Yes, marked made up. "Do not invent data" is read as applying to recipes |
| 4 | **Bunch sizes:** M&S rose 10 or 30? (The paper's 20 suggests 10.) Is the other orange rose 60? Is hydrangea "35+" exactly 35? Sunflower isn't in the flower list, so what's its bunch size? | M&S 10, orange rose 60, hydrangea 35, sunflower needs data |
| 5 | **Half-moon hoop:** the recipe sums to 43, the paper says 45. Are the 3 "blooms" chrysanthemum blooms (orange)? | Use 43 and that flower |
| 6 | **Groom and buttonholes:** how much wax flower? The paper shows 1 bunch of 48, which doesn't settle it. | 1 each |
| 7 | **Spray carnation:** Appendix A's target says 10 stems, but the table gives 1 + 7 = 8, so 1 bunch with 2 spare. Is 10 the bunch size written as the total? | Use 8, as recipe arithmetic wins |

## Rules I will add unless you object

The plan doesn't settle these. Each will be recorded in `DECISIONS.md`.

1. **Thin-bunch threshold is stored as a whole-number percent** (`15`, not `0.15`). In floating point, `floor(0.29 × 100)` gives 28, not 29.
2. **A flower that only receives floating stems is priced as if it needs 1 stem** when choosing a supplier. Its pre-floating cost is 0 at every supplier, so otherwise supplier id alone would pick it, and floating placement would use the wrong price and bunch size.
3. **Needs-data flowers rank last for floating stems**, since their cost and bunch size are unknown. They are used only when a line has no other choice.
4. **An override pointing at a supplier with no usable price is treated as needs data**, with a warning. It doesn't quietly switch supplier.
5. **Cost per design uses largest-remainder rounding**, so design costs stay whole pence and sum exactly to the total. Needs-data flowers are excluded.
6. **Unassigned stems are reported separately on each design line**, so invariant 5 reads "each placement sums to its recipe stems, less any unassigned stems".
7. **`trackLeftovers: false` flowers still count towards total spare stems.** They only skip warnings.
8. **Bad plan values throw; bad price data doesn't.** A negative or fractional quantity or stem count is a programming error and throws `RangeError`. A bad price report comes from people, so it is treated as needs data.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
- `docs/phases/phase-1-output.md`: engine output for the fixtures as a plain table for your mum to review. It uses made-up names only.
- There is no UI in this phase, so there is nothing to check on a phone.
