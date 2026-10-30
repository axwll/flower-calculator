# Phase 3 brief: Allocation map and print

Status: **built, awaiting owner review.** Your mum can only judge the printout fairly once recipes are confirmed.

Goal: turn an event into a work plan that helpers can print and arrange from. It adds a Work plan step with per-design cards, a flower matrix, and a print stylesheet with "Save as PDF". See [PLAN.md](../PLAN.md) sections 6 (Step 7), 7 and 10.

**Done when:** a helper could arrange from the printout alone, judged by your mum.

Baseline on 2026-10-30: commit `0e4da4f` on `main`, with `npm run check` passing on Node 24.

## Where this sits

Phase 2's "done when" hasn't been run, because it needs confirmed recipes and flowers. This phase can be built without them, but your mum can't fairly judge a printout of placeholder recipes, so both tests depend on the same data:

- The seven open questions in [phase-1.md](phase-1.md).
- The remaining designs, flower roles and foliage.

Real prices aren't needed for Phase 3, because the work plan shows no costs.

## Decisions needed before I start

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | **How should a card read?** By flower (the plan's wording), or by placement ("Bouquets 1 to 3: 2 scabious, 4 roses...")? A helper making bouquet 5 wants the second, but round-robin dealing can make many small groups. | **By flower, as the plan says,** with a compact grid when a design has several placements. Your mum can compare it with her paper sheet. |
| 2 | **Should the printout show the event name?** Section 7 says no client details, and event names often contain them ("Smith wedding"). Helpers may still want to tell events apart. | **Leave it out.** The printout just says "Work plan". |

## Files

```
engine/placements.ts        Combines a flower's stems across a design's lines
engine/placements.test.ts   Tests for that
engine/index.ts             Exports it
app/router.ts               Adds the work plan route
app/views/EventLayout.vue   Adds a fourth step, "Work plan"
app/views/WorkPlanView.vue  Cards, matrix toggle, print controls
app/components/             WorkPlanCard, FlowerMatrix, LeftoverPoolCard
app/styles/print.css        Print stylesheet
app/wording.ts              Per-placement wording
app/__tests__/              Tests for the above
```

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first where behaviour is defined, implement, `npm run check` green, then the next one.

### 1. Combine stems per design

- A flower can appear on more than one line of a design, such as a named line and a role line. Cards show it once, so its stems are summed placement by placement and regrouped into ranges.
- This is a pure engine function, built on the existing `perPlacement` counts.

**Tests:** a flower on two lines sums correctly, ranges regroup, unassigned stems stay separate, and a property test that combined counts still sum to each placement's recipe.

### 2. Per-placement wording

- Quantity 1 reads "5 Focus rose (white)".
- Several placements read "2 each for 1 to 3, 1 each for 4 to 7", as design names are plural and there's no singular name to use.
- Identical counts read "4 each".
- Placements with no stems of a flower are left out of the wording.

**Tests:** each wording case, including the plan's scabious example, a wrapped range, and a single stem.

### 3. Work plan step and design cards

- A fourth step, "Work plan". One card per enabled design with at least one placement.
- Each card shows the design, size, quantity and stems per flower with per-placement wording.
- Unassigned stems are shown as a clear warning on the card.
- Needs-data flowers still appear, as their stems are known.
- The vase pool appears as a final card listing spare stems, for information only.
- No costs, suppliers or prices appear anywhere on this step.

**Tests:** disabled and zero-quantity designs are left out, a flower on two lines appears once, unassigned stems show, the pool card shows spare stems, and no "£" appears in the output.

### 4. Flower matrix

- An optional view with flowers down, designs across, and total stems in each cell, plus row totals.
- It scrolls sideways inside its own box on a phone, and the page itself never scrolls sideways.

**Tests:** cells match the design cards, row totals match each flower's stems, and it can be switched on and off.

### 5. Print stylesheet and Save as PDF

- A "Save as PDF" button calls `window.print()`.
- Printing hides tabs, steps, buttons and the summary bar, and uses large type.
- A card never splits across pages.
- A "One design per page" option.
- The printout shows the design cards, and the matrix only if it's switched on.
- No client details and no quote.

**Tests:** the button calls `window.print()`, and the page option sets the class the stylesheet uses. Print output itself can't be tested automatically, so it goes on the manual checklist.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **The printed heading is "Work plan" only,** if you agree with question 2. Date and budget stay off as well.
2. **Gather notes stay on the review screen.** Section 7 doesn't list them for the work plan.
3. **The print options aren't remembered,** as nothing is saved until Phase 4.

## Out of scope

Timelines or prep order, bucket reference numbers, and quotes, as listed in section 13.

## Known risks

- **iPhone print support:** `window.print()` should work in Safari. It may not work once the app is installed to the home screen, which arrives in Phase 4, so that needs checking then.
- **Page breaks:** browsers differ on them, so "One design per page" needs checking on a real iPhone and a real Android phone.
- **Matrix width:** a full wedding has about 16 flowers and 10 designs, so it may need landscape to be readable on paper.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
- Steps to print and save a PDF on iPhone and Android.
- A sample PDF of the seed wedding from a desktop browser, marked as using placeholder recipes.
