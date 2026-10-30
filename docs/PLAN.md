# Flower Calculator: Build Plan

Handoff document for the implementing agent. Read all of it before starting. The decisions in it were made with the product owner and should not be reopened without asking.

---

## 0. How you (the agent) must work

### Ground rules
- **You never run git write commands.** The owner handles all commits. Do not run `git add`, `commit`, `push`, `branch`, `checkout`, `merge`, `rebase`, `stash` or `reset`. Read-only `git status` and `git diff` are fine, and use them at the end of each phase to give the owner a summary of what changed.
- **Phase 0 (project setup) is done manually by the owner.** Do not scaffold the project. If something from section 2 is missing, stop and report it.
- **Do not add dependencies** beyond those listed in section 3 without asking. Explain why when you ask.
- **No secrets in the repo.** The repo is public. See section 12.
- **Do not expand scope.** Anything listed in section 13 (Out of scope) must not be built, however easy it looks.
- **Ask when ambiguous.** Section 14 lists the known open questions and the defaults to use. For anything else, ask the owner before guessing.
- **Record deviations.** If you change a decision, add a dated entry to `docs/DECISIONS.md` saying what changed and why, and flag it in your end-of-phase summary.

### The iterative loop
Work one **phase** at a time, and within a phase one **feature** at a time.

1. **Phase brief (then stop for approval).** At the start of each phase, write a short brief to `docs/phases/phase-N.md` containing: the features in order, acceptance criteria for each, files you expect to touch, and the tests you will write. Post a summary and **wait for the owner's go-ahead.**
2. **Feature loop.** For each feature in the phase:
   1. Write or extend the tests first where the behaviour is defined (always for the engine).
   2. Implement the feature.
   3. Run `npm run check` (see below). It must be fully green.
   4. Fix failures at the root. Do not weaken tests, add `eslint-disable`, or add `@ts-ignore` to get green. If a test is wrong, say so and explain.
   5. Only then start the next feature.
3. **Phase end (then stop).** Give the owner: a plain-English summary of what was built, `git status` / `git diff --stat` output, how to try it by hand (exact commands or steps, including on a phone), any deviations, and open questions. **Stop and wait.** The owner reviews, commits, and tells you to continue.

### Definition of done (every feature)
- Types are complete, with no `any` unless justified in a comment.
- Tests cover the happy path, edge cases and failure modes.
- `npm run check` passes: type check, lint, format check and tests.
- No dead code, no stray `console.log`, no unexplained TODOs.
- User-facing text uses the product vocabulary in section 4 (not internal jargon).
- Any new decision is written to `docs/DECISIONS.md`.

### Required npm scripts
The owner sets these up in Phase 0. Verify they exist at the start of Phase 1.

| Script | Does |
|---|---|
| `dev` | Vite dev server |
| `build` | Production build (type check plus Vite build) |
| `typecheck` | `vue-tsc --noEmit` over everything |
| `lint` | ESLint, zero warnings allowed |
| `format` | Prettier write |
| `format:check` | Prettier check |
| `test` | Vitest run (non-watch) |
| `test:coverage` | Vitest with coverage; the engine needs ≥ 90% lines and branches |
| `check` | `typecheck && lint && format:check && test` |

Phase 1 also adds an ESLint rule so that **`engine/` cannot import from `vue`, `pinia`, `dexie`, the DOM, or anything in `app/` or `api/`.**

---

## 1. What we're building

A phone-friendly web app (PWA) that helps a florist (the owner's mother) turn her flower formulas and current wholesale prices into an **event estimate**: how many stems of each flower to buy, from which supplier, what it costs, what will be left over, and a **work plan** (allocation map) that helpers can print and use to arrange flowers before the day.

It is shared with a small group of friends (roughly 5 to 10 people), each building and saving their own plans. Master recipes and flowers are global. Prices are crowd-updated.

**Goals (from her proposal):**
1. Save time: standardised formulas for the number of flowers per design.
2. Save money: avoid over- and under-ordering. **Minimise wasted stems.**
3. Budget effectively: plug in market prices per supplier.

**Constraints:** free hosting, minimal third parties, works on iPhone and Android, works offline, no accounts.

---

## 2. Phase 0: owner's manual setup (not the agent's job)

The agent can assume all of this exists when it starts Phase 1:

- [ ] Public GitHub repo, with this file at `docs/PLAN.md`.
- [ ] Vite + Vue 3 + TypeScript scaffold (`npm create vue@latest`) with Pinia, Vitest, ESLint and Prettier (Vue Router optional).
- [ ] `fast-check` installed as a dev dependency.
- [ ] All npm scripts from section 0 working.
- [ ] Folder layout (section 3) created.
- [ ] `.gitignore` covers `node_modules`, `dist`, coverage output, `.clasp.json`, `.clasprc.json`, `*.jpg`, `*.jpeg`, `*.png`, `*.heic` under `fixtures/` and `docs/`, and any `.env*`.
- [ ] Vite `base` set to the GitHub Pages path (`/<repo-name>/`).
- [ ] GitHub Pages deploy workflow working, and the empty app confirmed loading on a real phone.

---

## 3. Stack and layout

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere (strict mode) |
| UI | Vue 3 (Composition API, `<script setup>`), Pinia |
| Build | Vite |
| PWA | `vite-plugin-pwa` (added in Phase 4) |
| Phone storage | IndexedDB via `dexie` (added in Phase 4) |
| Backend | Google Apps Script web app bound to a Google Sheet, deployed with `clasp` (Phase 5) |
| Sharing | Native `CompressionStream` gzip, no library |
| PDF | Print stylesheet plus the browser's "Save as PDF", no library |
| Tests | Vitest and `fast-check` |
| Hosting | GitHub Pages |

```
engine/      Pure TypeScript logic and its tests. No UI, DOM, network or storage.
app/         Vue application (components, stores, views, styles).
api/         Apps Script source (deployed with clasp). Added in Phase 5.
fixtures/    Anonymised test data (JSON). Imported by tests, never by app/.
docs/        PLAN.md, DECISIONS.md, phases/
```

`fixtures/` must never be imported by anything in `app/` (enforce with ESLint). The app's seed data (Phases 2 to 4) is a separate file, `app/seed/seed.ts`.

---

## 4. Vocabulary (use her words in the UI)

| Term | Meaning |
|---|---|
| **Design** | A type of arrangement (bridal bouquet, buttonhole, pedestal, ...). About 15 exist. |
| **Size** | Small, Medium, Large or **Fixed** (a design with no size variants). Every design has at least one size. |
| **Recipe** (a.k.a. formula) | The stems needed for **one placement** of a design at a size. One recipe per design and size. Larger sizes add flower types and counts, so they are not linear multiples. |
| **Placement** | One physical instance of a design. "Bridesmaid's bouquets ×7" is 7 placements. |
| **Recipe line** | One line of a recipe: either a **role** line (7 focal) or a **named flower** line (5 hydrangea). |
| **Role** | A slot filled by flowers chosen per event. Fixed list: `focal`, `secondary`, `filler`, `foliage`, `accent`. Only the owner edits this list. |
| **Palette** | For an event: which flowers are ticked for each role. |
| **Flower** | A specific product, such as "Dahlia (peachy)". Colour variants are separate flowers. A flower can be eligible for several roles. |
| **Supplier** | Wholesaler, supermarket or other. Roughly 5, and flowers come from different suppliers. |
| **Sold as** | `bunch` (fixed stems per bunch, priced per bunch), `stem` (priced per stem, no leftovers), or `foraged` (free, no supplier, goes on the gather list). |
| **Event** | One wedding or job: a copy of the recipes plus a palette, quantities and choices. |
| **Work plan / allocation map** | The printable per-design breakdown for helpers. |

---

## 5. Domain model

All money is **integer pence** internally. Display with one formatter (`Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`). Entry fields accept pounds as a string and parse to pence **without floating-point maths**.

```ts
type Role = 'focal' | 'secondary' | 'filler' | 'foliage' | 'accent';
type SoldAs = 'bunch' | 'stem' | 'foraged';
type Size = 'Small' | 'Medium' | 'Large' | 'Fixed';

interface Flower {
  id: string; name: string; colour?: string;
  roles: Role[];               // roles this flower can fill (may be several)
  soldAs: SoldAs;
  trackLeftovers: boolean;     // false exempts it from leftover/thin-bunch warnings
  active: boolean;
}

interface Supplier { id: string; name: string; type: 'wholesaler' | 'supermarket' | 'other'; active: boolean }

interface PriceReport {
  id: string; flowerId: string; supplierId: string;
  pricePence: number;          // per bunch (bunch) or per stem (stem)
  stemsPerBunch: number;       // 1 for stem-sold
  reportedAt: string;          // ISO
  offerEndsAt?: string;        // ISO; after this the report no longer applies
  note?: string; reportedBy: string;
  status: 'active' | 'voided';
}

interface Design { id: string; name: string; group: string; optional: boolean; isLeftoverPool?: boolean }

type RecipeLine =
  | { kind: 'role'; role: Role; stemsPerUnit: number }
  | { kind: 'named'; flowerId: string; stemsPerUnit: number };

interface Recipe { designId: string; size: Size; lines: RecipeLine[]; version: number }

interface EventPlan {
  schemaVersion: number;
  id: string; name: string; date?: string; targetBudgetPence?: number;
  designs: PlanDesign[];
  palette: Record<Role, string[]>;                 // flowerIds ticked per role
  supplierChoice: Record<string, string>;          // flowerId -> supplierId (override)
  settings: PlanSettings;                          // thresholds copied in at creation
  purchase?: PurchaseSnapshot;                     // immutable once set
}
interface PlanDesign {
  designId: string; size: Size; quantity: number; enabled: boolean;
  recipe: Recipe;                                  // COPY, edited only inside this event
  excludedFlowerIds: string[];                     // "leave this flower out of this design"
}
```

Plans **copy** their recipes when created, so editing a master recipe never changes an existing event.

### Settings and defaults (all adjustable in the Settings screen)

| Setting | Default |
|---|---|
| Thin-bunch threshold | 15% |
| Price amber after / red after | 14 days / 30 days |
| Big price-change confirmation | 50% |
| Admin key, shared app key, nickname | entered by the user |

---

## 6. The allocation engine (the core)

`engine/` exposes a pure function, roughly `allocate(plan, prices, settings, now) => AllocationResult`, deterministic and with no side effects. It returns, for every flower: stems needed, source, bunches, spare stems, cost and flags. It also returns per-design and per-placement stem counts, warnings and totals.

### Step 1: Expand the plan into lines
For each **enabled** design, `units = quantity`.
- **Named line:** `stems = stemsPerUnit × units` goes to that flower. Exact, no choices.
- **Role line:** `total = stemsPerUnit × units`. The eligible flowers are `palette[role]` minus the design's `excludedFlowerIds`, with `k` the number of eligible flowers.
  - If `k = 0`, emit a warning ("no flowers ticked for <role> in <design>") and leave the stems **unassigned**. Never drop them silently.
  - Otherwise each flower gets `floor(total / k)` and the remainder `f = total mod k` becomes **floating stems** for that line.

**Split at the line total, not per placement.** Seven bouquets with 5 secondary stems across 3 flowers is 35 stems: 11 each plus 2 floating. It is not 7 separate remainders. Per-placement counts are produced later (Step 7).

### Step 2: Aggregate
Sum fixed and equal-share stems per flower **across the whole plan** (all roles, all designs). A flower can be used in several roles and designs, and this is how bunches get fully used.

### Step 3: Choose a supplier per flower (before floating stems)
- Use the user's override in `supplierChoice` if present.
- Otherwise compare candidate suppliers on the **actual cost to cover the pre-floating stems**: `ceil(stems / stemsPerBunch) × price` (or `stems × price` for stem-sold). Choose the cheapest.
- **Stale prices** (past the red threshold) must not silently win. Pick the cheapest among non-stale prices if any exist. If only stale ones exist, use the newest and flag it. Show stale cheaper alternatives as flagged options.
- Ties break by a stable order (supplier id).
- The current price for a flower and supplier is the **newest active report whose offer has not ended**. Voided reports are ignored.
- After Step 4, re-check whether the choice still holds. If it flips, apply the new choice and note it. Keep this to a single pass so it cannot loop.
- Flowers with no price or no bunch size are marked **needs data**: stems are counted, cost is excluded, and a warning is emitted. Do not guess a bunch size.

### Step 4: Place the floating stems
Each floating stem belongs to a specific role line and may only go to one of **that line's eligible flowers**. A line with `f` floating stems gives them to `f` **distinct** flowers (since `f < k`), so every flower ends up with exactly `floor` or `ceil` of its equal share on that line. This **strict split** is a hard invariant.

Resolve lines in a stable order. For each floating stem, pick the eligible flower (that does not already hold a floating stem for this line) by this priority:
1. A `bunch` flower with **spare stems** in its already-bought bunches (a free stem), taking the one with the most spare.
2. A `foraged` flower (free).
3. A `stem`-sold flower (exact cost, no waste).
4. Otherwise a `bunch` flower, preferring the lowest added cost, then the smallest bunch size, then stable order.

Track spare stems as you go, because placing a stem changes later decisions. Waste outranks cost: **minimise spare stems first, then cost.**

Test the greedy placement against **brute force on small cases**. If brute force finds a better outcome, either improve the algorithm or record the gap in `DECISIONS.md`. For small instances (say ≤ 12 floating stems in total) an exhaustive search is acceptable in production if it is fast.

### Step 5: Bunches, spare stems, cost

| Sold as | Calculation |
|---|---|
| `bunch` | `bunches = ceil(stems / bunchSize)`; `spare = bunches × bunchSize − stems`; `cost = bunches × price` |
| `stem` | exact count; `cost = stems × price`; no spare |
| `foraged` | goes on the **gather list**; cost 0; no spare |

**Thin-bunch warning:** for `bunch` flowers with `trackLeftovers`, let `lastUsed = stems − (bunches − 1) × bunchSize`. Warn if `lastUsed ≤ floor(threshold × bunchSize)` and `lastUsed < bunchSize`. With the 15% default:
- bunch of 48: warns at 7 or fewer
- bunch of 20: warns at 3 or fewer
- bunch of 10: warns at 1

### Step 6: Leftover pool (the "table vases" idea)
A design flagged `isLeftoverPool` has no recipe. It is a catch-all that absorbs spare stems. The engine reports, per flower, the spare stems, and for the pool, `spare ÷ quantity` as information only (e.g. "11 vases: about 3.5 stems each").
- **No cap and no enforcement.** The arrangers decide how much to use.
- The headline waste figure is **total spare stems** (and their cost). Do not call anything "true waste" in the UI. Label it "spare stems".

### Step 7: Per-placement counts (for the allocation map)
For each design line with `quantity = q > 1` and per-flower totals decided, deal stems to placements as follows. Lay the flower stems in a list grouped by flower, then deal them round-robin to placements `0..q−1`. Each placement then gets exactly `stemsPerUnit` stems, and each flower is spread as evenly as possible (a difference of at most 1 between placements). Group placements with identical counts into ranges for the map ("bouquets 1 to 3 get 2 scabious, 4 to 7 get 1").

### Step 8: Rollups
- Order list grouped by supplier, with subtotals and a grand total.
- **Cost per design:** each flower's effective cost per stem is `flower cost ÷ stems allocated to designs` (this spreads the spare-stem cost across designs). The design's cost is the sum over its flowers. Exclude the leftover pool.
- Budget check: if `targetBudgetPence` is set and the total exceeds it, report the top cost drivers by flower and by design (Phase 8 builds the UI).

### Engine invariants (property tests with `fast-check`)
1. Stems are never lost or invented: the sum of allocated stems equals the sum of recipe stems, except for unassigned role stems, which must appear in warnings.
2. On every role line, each flower's stems are `floor(total/k)` or `ceil(total/k)`.
3. `spare ≥ 0`, and `bunches × bunchSize ≥ stems` for bunch flowers.
4. Determinism: the same inputs always give the same output.
5. Per-placement counts sum to the flower totals, and each placement sums to its recipe stems.
6. Greedy floating placement is no worse than brute force on small random cases, or the gap is documented.
7. Money values are integers.

---

## 7. Screens and flows (built in Phases 2 to 3, extended later)

Phone-first, one-handed, and also usable on a laptop. Bottom tabs: **Events**, **Prices**, **Library**, **Settings**. Admin-only parts show only when the admin key is set.

### Plan builder (designs first, then palette)
1. **Event setup:** name, date, optional target budget, and "start blank" or "duplicate event".
2. **Designs:** one card per design with a size picker (Small / Medium / Large / Fixed), a quantity stepper, and an on/off switch for optional designs. Tapping a card opens the event's **copy** of the recipe, where counts can be changed or a role swapped for a named flower **for this event only**.
3. **Palette:** one section per role **that the chosen designs actually use**. Each shows tickable flowers (role-eligible first, with "show all" for the rest), plus source, bunch size and current price. Each tick shows the split live ("7 stems across 3 flowers: 2, 2, 2 + 1 floating"). A flower used in more than one role gets a "shared" badge with its combined stem total. A collapsed per-design toggle allows "leave this flower out of this design".
4. **Review:** see below.

A sticky bar on steps 2 and 3 shows **estimated cost, total stems and spare stems**, updated live.

Flowers missing a price or bunch size show a **needs data** badge, can still be ticked, and are excluded from cost. The review lists "N flowers missing prices".

### Review
- **Order list**, grouped by supplier, with stems needed, bunches, spare stems, cost, thin-bunch warnings, subtotals and a grand total.
- **Gather list** for foraged items, with an optional note per line.
- **Leftovers:** per-flower spare stems and the vase pool (information only).
- **Warnings:** unassigned role stems, needs-data flowers, stale prices, thin bunches.

### Allocation map
- One card per design showing stems per flower, with per-placement wording.
- Optional matrix view (flowers down, designs across).
- Print stylesheet: large type, optional one design per page, and a "Save as PDF" button that calls `window.print()`. No client details and no quote.

### Prices tab (Phase 5)
Searchable flower list with the latest price per supplier and its age. Tapping a flower gives a prefilled form (supplier, price, stems per bunch, note, optional offer-ends date). **Shop mode:** pick a supplier and see their flowers with last prices, tapping to update. Price updates should take under 10 seconds.

### Library, admin only (Phase 6)
Recipe editor, flower editor, supplier list, plus "save event recipe to library".

### Settings
Thresholds from section 5, nickname, admin key, export/import.

---

## 8. Persistence and sharing (Phase 4 and Phase 7)

**On the phone (Dexie / IndexedDB):**
- Events are stored with `schemaVersion`. Write migrations from day one.
- Request persistent storage. Show a first-run guide: Android install prompt, and a step-by-step **Add to Home Screen** walkthrough for iPhone/Safari (storage is only reliable once installed).
- **Export all** to one JSON file and **Import** to restore. Nudge for a backup after each purchase.
- **Duplicate event:** copies the recipes, palette and quantities. By default it resets prices to live and clears purchase state, with an option to keep frozen prices.

**Purchase:** "Mark as purchased" shows exactly which prices will be frozen, then stores an **immutable snapshot**: recipe copies, palette, allocation result, the resolved price per flower (supplier, price, bunch size, report date and report id), and settings. The working event stays editable afterwards with frozen prices, newly added flowers use live prices, and edits after purchase are flagged "added after purchase".

**Sharing a plan (Phase 7):** compress the event with gzip, encode as base64url, and write it to the `SharedPlans` tab via the API, which returns a long random id. Opening `…/#/shared/<id>` imports a **copy**. It is not live collaboration. If the compressed plan exceeds the cell limit (about 50,000 chars), show a clear error. Revocation, mum viewing friends' plans, and sending changes back are all out of scope.

**Sharing the app:** the URL. The first load fetches master data, then it is cached for offline use.

---

## 9. Backend (Phase 5): Apps Script plus Google Sheet

The sheet is a human-readable database. **All reads and writes go through the app**, and no one edits the sheet day to day. The owner can fix a row by hand if something goes wrong, so keep tabs normalised and readable (no JSON blobs, except in `SharedPlans`).

**Tabs:** `Meta` (data version stamp), `Flowers`, `Suppliers`, `Prices`, `Designs`, `Recipes`, `RecipeLines`, `SharedPlans`, `Changelog`.

**Rules:**
- A **setup script** (`api/setup.gs`) creates all tabs and headers and seeds starting data, so a fresh sheet on another Google account is one run. The API URL lives in one config value in the app.
- **Append-only** writes: edits add rows with a timestamp (and version or active flag where relevant). Prices are voided, never deleted. Every admin edit is written to `Changelog`.
- One `doGet` for reading master data (`?since=<version>` returns "unchanged" or the new data) and one `doPost` with an `action` field. The app sends **`Content-Type: text/plain`** JSON to avoid CORS preflight, which Apps Script cannot handle.
- **LockService** around every write. **CacheService** for reads.
- The **admin key lives in Script Properties**, never in the sheet or the repo. Recipe, flower and supplier edits require it. Price reports and shares require only the shared app key.
- Be honest in code comments that the shared app key is shipped in the page and is a speed bump, not security.
- Deploy as "execute as me, access: anyone". Develop against the owner's test sheet, then the owner creates a fresh sheet on their mother's account with her as full owner, and the owner is added as editor. The mother should do the first deployment herself.

**Price rules:**
- Report fields are in section 5. Offers are reports with `offerEndsAt`. A quantity deal such as "2 for £15" is entered as the effective per-bunch price (£7.50 for 1 bunch) with the note "offer on". There is no special deal support.
- Anyone can void **their own** report, and the admin key can void any. Voiding restores the previous price automatically.
- If a new price differs from the last by more than the threshold (50%), ask for confirmation ("Was £10, now £100. Is that right?").
- Prices show their age, amber at 14 days and red at 30.
- Offline: entries go into a local queue, show "pending sync", and send on reconnect with their **original** timestamp. Do not rely on iOS background sync, so retry on app open and on the `online` event.

---

## 10. Phases

The **prototype is Phases 1 to 3.** It uses seed data from a local file, with no backend and no saving. It proves the maths, the flow and the printout.

### Phase 1: Engine
Features, in order:
1. Types, money helpers (pounds ↔ pence, formatter), ESLint boundary rule for `engine/`.
2. Expand plan into lines, and the equal split with floating remainders (Step 1).
3. Aggregation across designs and roles (Step 2).
4. Current-price resolution (newest active, offers expiring, voided ignored) and supplier choice (Step 3).
5. Floating-stem placement (Step 4) with a brute-force comparison test.
6. Bunch rounding, spare stems, thin-bunch warnings, and the three sold-as modes including the gather list (Step 5).
7. Leftover pool and cost rollups (Steps 6 and 8).
8. Per-placement dealing and range grouping (Step 7).
9. Fixtures from Appendix A, golden tests, and the property tests.

**Done when:** the Appendix A bridal and reception fixtures produce the expected results, all invariants pass as property tests, coverage is ≥ 90%, and `npm run check` is green. Owner checkpoint: the engine output is shown to mum as a plain table.

### Phase 2: Plan builder and review (UI)
Uses `app/seed/seed.ts` (flowers, suppliers, prices, designs and recipes, including **placeholder** Small/Medium/Large recipes), with an in-memory Pinia store. Features: app shell and tabs, seed loading, event setup, designs step, palette step, sticky summary bar, review screen (order list, gather list, leftovers, warnings), needs-data badges.
**Done when:** the owner can rebuild last wedding on a phone and compare it with the paper sheet.

### Phase 3: Allocation map and print
Per-design cards, per-placement wording, flower matrix, print stylesheet, "Save as PDF".
**Done when:** a helper could arrange from the printout alone (judged by mum).

### Phase 4: Persistence and PWA
Dexie events, duplicate event, export/import, service worker, offline use, install guidance for iPhone and Android.
**Done when:** events survive closing the app and work offline on both iPhone and Android.

### Phase 5: Backend and prices
Setup script, Apps Script API, version stamp and caching, price reports, Prices tab, shop mode, staleness, big-change confirmation, voiding, offline queue.
**Done when:** a friend updates a price on their phone and mum sees it.

### Phase 6: Admin
Admin key entry, recipe/flower/supplier editors, "save to library", `Changelog`.
**Done when:** mum creates a "no dahlia" buttonhole variant without help.

### Phase 7: Purchase and sharing
Mark as purchased and the snapshot, editing after purchase, share links and import, price-changed-since-viewed notice.
**Done when:** a shared plan opens on another phone with its frozen prices intact.

### Phase 8: Polish
Nudges (try ±1 placement, toggling a palette flower or an optional design, and report the top few by spare-stem reduction, then cost, applied only when tapped), budget check UI, edge cases from real use.

---

## 11. Testing and validation expectations

- **Engine:** TDD, golden tests from fixtures, property tests, and a brute-force comparison.
- **Stores and logic in `app/`:** unit tests.
- **Components:** test behaviour, not markup. Cover the key flows (add a design, tick a palette flower, see the totals).
- **API:** extract pure functions from Apps Script so they can be unit tested locally. Test the sheet-facing layer by hand using a checklist in the phase brief.
- **Manual device checks** go in each phase's summary: what to tap, what to expect, on iPhone and Android.
- **Accessibility basics:** labelled controls, tap targets of at least 44px, sufficient contrast, and keyboard use on desktop.

---

## 12. Privacy and repo hygiene

The repo is public and the app bundle is public.
- **No photos or scans** of the paper sheet anywhere in the repo.
- **No real client names**, couples or event details. Fixtures use made-up data.
- **No secrets.** The admin key lives only in Apps Script Script Properties. The Apps Script URL and the shared app key live in a single config file and are known to be public.
- `fixtures/` is test-only and must not be bundled into the app.

---

## 13. Out of scope for v1

Do **not** build: client quotes or proposals, margin/markup calculations (store costs so they can be added later), a timeline or prep order in the work plan, user accounts, mum viewing friends' shared plans, revoking shares, sending changes back to a sharer, quantity-deal pricing, live collaboration, native app-store apps, and "bucket" reference numbers.

---

## 14. Open items and assumptions

| Item | Assumption until answered |
|---|---|
| **Small vs large example from mum (pending)** | One full recipe per design and size, with placeholder fixtures. If her example shows a lot of repetition, add a "copy from another size" button in the editor. Does not affect the engine. |
| Are dahlias bought per stem? | Treat as `stem` if the data says so. Confirm at data entry. |
| Are the bridal rows role-based or named flowers? | Use named flowers in fixtures. Confirm at data entry. |
| Missing bunch sizes in her sheet | Missing data, not per-stem. Flag as needs data. |
| Header numbers on her sheet (bunch size vs something else) | Appendix A lists bunch sizes as read, with doubts noted. The owner confirms before they become fixtures. |
| Can the same design omit a ticked flower? | Yes, via the optional collapsed per-design toggle. |
| Her sheet's "Flwr" column and some subtotals | Known to contain errors. Ignore them and use recipe sums. Golden tests compare against the engine's own correct arithmetic. |

---

## Appendix A: Fixture source data (anonymised)

Transcribed from the paper sheet for a past event, with identifying details removed. **The agent cannot see the original.** Cells marked ⚠ were hard to read, so ask the owner to confirm before turning them into fixtures. Where the paper totals disagree with the recipe arithmetic, the recipe arithmetic wins.

### Flowers and bunch sizes (from column headers)

| Flower | Bunch size | Notes |
|---|---|---|
| Focus rose (white) | 48 | |
| Secondary rose (M&S orange) | 30 ⚠ | Mum says M&S sells in 10s. Confirm which. |
| Secondary rose (orange) | 60 ⚠ | |
| Spray carnation (white) | 10 | |
| Dahlia (dark) | not given | Possibly per stem. Treat as needs data. |
| Dahlia (orange) | not given | |
| Dahlia (peachy) | not given | |
| Chrysanthemum santini (orange) | 30 | |
| Wax flower | 48 | Her subtotal of "1" means 1 bunch. |
| Scabious / paw paw | not given | |
| Burgundy carnation | 10 | |
| Chrysanthemum blooms (orange) | 20 | |
| Lisianthus ("lucendraum") | 20 | ⚠ name uncertain |
| Hydrangea heads | 35+ | |
| Alstroemeria | 20 | |

### Bridal section (stems per placement)

| Design | Qty | Stems per placement | Confidence |
|---|---|---|---|
| Bridal bouquet | 1 | focus rose 5, M&S orange rose 3, spray carnation 1, dahlia dark 4, dahlia orange 3, dahlia peachy 3, wax flower 1, scabious 5 | good |
| Bridesmaid's bouquets | 7 | focus rose 4, M&S orange rose 2, spray carnation 1, dahlia dark 2, dahlia orange 2, dahlia peachy 2, wax flower 1, scabious 5 | good |
| Groom | 1 | 1 dahlia (orange), 2 santini, plus wax flower and scabious ⚠ | ⚠ |
| Buttonholes | 4 | 1 rose, 2 santini, plus wax flower and scabious ⚠ | ⚠ |
| Ladies' corsages | 2 | "1 rose, 2 dahlia" per label, with grid cells showing rose 1 and orange dahlia 1 ⚠ | ⚠ |

**Reconciliation targets from the paper (use as sanity checks, not truth):**
- Focus rose: 5 + 28 + 4 + 2 = **39** (matches her total, 1 bunch of 48, 9 spare, and she shows **9** in the table-vases row, which confirms the "vases take what's left" idea).
- Spray carnation: 10 (1 bunch, 0 spare).
- Dahlia dark: 4 + 14 = 18. Dahlia peachy: 3 + 14 = 17.
- M&S orange rose: 3 + 14 = 17, while the paper shows 20, consistent with 2 bunches of 10.
- Santini: 2 (groom) + 8 (4 buttonholes × 2) = 10.
- Scabious: 5 + 35 + 3 + 2 + 2 = 47.
- Dahlia orange: recipe arithmetic gives 20, the paper says 18 (a paper error).

### Reception section

Role names are her shorthand: `hyd` = hydrangea (a named flower), `focal`/`sec`/`filler` are roles, `sun` = sunflower.

| Design | Qty | Recipe per placement | Check |
|---|---|---|---|
| Top table | 1 | 5 hydrangea (named) + 7 focal + 13 secondary + 10 filler | 35 total ✓ |
| Pedestals | 2 | 5 hydrangea (named) + 5 focal + 10 secondary + 13 filler | 33 × 2 = 66 ✓ |
| Half-moon hoop | 1 | 10 sunflower (named) + 10 hydrangea (named) + 20 filler + 3 "blooms" ⚠ | 43, paper says 45 ⚠ |
| Pumpkins | 3 | 20 stems each ⚠ | 60 ✓ |
| Pumpkin white posey | 2 | 20 small stems ⚠ (per placement or in total?) | ⚠ |
| Table vases | 11 | `isLeftoverPool` (no recipe) | pool |

### Fixture rules
- Write fixtures as JSON in `fixtures/`, with made-up event and client names.
- Where a count is uncertain (⚠), either use the recipe-arithmetic value and note it in a `notes` field, or ask the owner. Do not invent data.
- Include invented **Small / Medium / Large** recipes for one design (e.g. Pedestal) so the size logic is tested before mum's real example arrives. Mark them `placeholder: true`.
- Include fixtures that deliberately exercise: a line that divides evenly, a line with a remainder, a multi-role flower, a stem-sold flower, a foraged flower, a thin-bunch case, a needs-data flower, an offer that has expired, a stale price, and a role with no ticked flowers.

---

## Appendix B: First instruction for the agent

> Read `docs/PLAN.md` in full. Confirm that the Phase 0 checklist in section 2 is satisfied and that all the npm scripts in section 0 work. Then write `docs/phases/phase-1.md` (the Phase 1 brief: features in order, acceptance criteria, files, tests), summarise it for me, and **stop and wait for my approval**. Do not run any git write commands.
