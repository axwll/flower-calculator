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

## 2026-10-30: Phase 1 engine rules the plan left open

- **Thin-bunch threshold is a whole-number percent** (`15`, not `0.15`). In floating point, `floor(0.29 × 100)` gives 28.
- **A flower that only receives floating stems is priced as needing 1 stem** when choosing a supplier. Its pre-floating cost is 0 everywhere, so supplier id alone would otherwise pick.
- **Needs-data flowers rank last for floating stems**, and the search scores needs-data stems first, then spare stems, then cost. Without that, a flower with no known cost looks free.
- **An override pointing at a supplier with no usable price is needs data**, with a warning. It does not quietly switch supplier.
- **Cost per design uses largest-remainder rounding**, so design costs sum exactly to the total.
- **Unassigned stems are reported on each design line.** Invariant 5 now reads: each placement sums to its recipe stems, less any unassigned stems.
- **`trackLeftovers: false` flowers still count towards total spare stems.** They only skip thin-bunch warnings.
- **Bad plan values throw `RangeError`. Bad price data does not throw:** a bad newest report makes that supplier unusable, and does not revive an older price.
- **`allocate` takes `{ plan, flowers, designs, prices, now }`**, because it needs flower and design data, and settings are already in the plan.
- **`allocate` has no supplier list**, so the caller must leave inactive suppliers' reports out of `prices`. Phase 2 does this when it loads data.
- **`purchase` and `PurchaseSnapshot` wait for Phase 7**, when their contents are designed.
- **`tsconfig.vitest.json` uses `ES2022` and DOM libraries.** The template's empty `lib` broke engine code imported by tests.

## 2026-10-30: Floating stems use a capped search, with a known gap

The Step 4 priority rules alone were beaten by brute force. On two lines, the rules give the first line to a free foraged flower, and the second line then opens a bunch with no stems to share it.

`placeFloating` now starts from the priority rules, then searches every combination and keeps a result only if it is strictly better on needs-data stems, spare stems, then cost. The search is limited by combinations, not the plan's suggested 12 floating stems, because combinations are what cost time.

The cap is 5,000 combinations. At 8,000 combinations, a plan with 6 flowers took 5.6ms on a laptop, and the cost grows with flowers and on slower phones.

**Known gap:** above the cap, the priority rules are used alone, so the result can be slightly worse than the best possible. Invariant 6 is tested up to 3 lines of 5 flowers, which is within the cap.

## 2026-10-30: Fixture values awaiting confirmation

No answers to the Phase 1 brief's seven data questions yet, so `fixtures/` uses the brief's fallbacks, noted in each file. Golden tests prove the engine's arithmetic on those values. They do not confirm the values themselves.

## 2026-10-30: Phase 2 decisions

- **`vue-router` added** with hash URLs, approved by the owner. The phone's back button moves between steps, and Phase 7 needs `#/shared/<id>`.
- **Seed data starts from the Phase 1 fixtures.** Prices and suppliers are invented, and are stamped at load so they never look stale. Pedestal Medium is the Appendix A recipe. Small and Large are placeholders.
- **Supplier change is on the review screen,** approved by the owner. "Best price" clears the override, and stale prices show as "old price" in the list.
- **`EventPlan.gatherNotes` is optional**, so existing fixtures stay valid. The engine ignores it.
- **Allocation reruns through one Pinia computed**, so screens never work out totals themselves.
- **No UI library.** Plain CSS with tokens.
- **The clock is read when allocation reruns**, then passed in as `now`, so the engine stays pure.
- **Names are looked up in the app.** The engine returns ids, and warnings are worded in `app/wording.ts`.
- **One card per design, so an event holds one size of each design.** The engine could take two sizes, but section 7 describes one card.
- **Changing size replaces the event's recipe** with a fresh copy, so edits made to the previous size are lost.
- **"Start blank" only.** "Duplicate event" comes in Phase 4, when events are saved.
- **Prices, Library and Settings are placeholders.** Plan settings use the section 5 defaults until Settings is built.
- **Default size is Medium** where it exists, otherwise the first size.

## 2026-10-30: Phase 3 decisions

- **Cards read by flower**, as the plan says, approved by the owner. Design names are plural and have no singular form, so wording uses placement numbers: "2 each for 1 to 3, 1 each for 4 to 7".
- **The compact grid only shows when placements differ.** The approved brief said it would show for several placements. When every placement matches, "4 each" already says it all, and the grid only lengthened the printout. It is also limited to 12 placements, so it fits a page.
- **The printout says "Work plan" only,** approved by the owner. Event name, date and budget stay off, because event names often contain client names.
- **The flower matrix prints on its own landscape page.** It overflowed portrait A4 with 10 designs. Browsers without named pages stay in portrait, so it also shrinks and wraps to fit.
- **`engine/` gained `combineDesignFlowers`,** because a flower can be on several lines of one design and helpers should see it once.
- **Gather notes stay on the review screen.** Section 7 doesn't list them for the work plan.
- **Print options aren't remembered,** as nothing is saved until Phase 4.

## 2026-10-30: Phase 4 decisions

The owner asked for this phase to start without approving the brief first, so these haven't been reviewed yet.

- **`fake-indexeddb` not added.** It isn't in section 3 and the owner couldn't be asked. Storage sits behind `EventRepository`, so tests use an in-memory version, and the Dexie layer was checked in real Chrome. That layer has no automated test.
- **Migrations cover event contents through `schemaVersion`.** Dexie's own version covers tables and indexes only.
- **A stored event that can't be read is skipped, counted and kept,** so a later version can still rescue it.
- **Saves aren't debounced,** so nothing is lost if a phone closes the app.
- **Event ids now include a random part.** The old counter restarted on each launch, so saved events could have collided.
- **Duplicate copies supplier choices as well** as recipes, palette and quantities. The name, date and budget come from the new event screen. "Keep frozen prices" arrives with purchases in Phase 7.
- **Import never removes events,** is all or nothing, and asks before replacing same-id events.
- **Backup nudges wait for Phase 7,** as the plan ties them to purchases.
- **Install guide is stored as dismissed in `localStorage`,** as a per-device convenience. If storage is blocked, it just reappears.
- **New versions install automatically** (`autoUpdate`). Saved events are unaffected, but anything typed into a form and not yet submitted could be lost.
- **Accepted: 4 low-severity `npm audit` findings** in `vite-plugin-pwa`'s build tooling. They are dev-only, production dependencies report 0, and the only offered fix is a very old major version.
- **The icon is a placeholder flower,** drawn for this phase.
