# Phase 2 brief: Plan builder and review

Status: **built, awaiting owner review.** Seed data is still unconfirmed, so the "done when" test has not been run.

Goal: on a phone, build an event from designs and a palette, watch the totals update, and review the order. It uses seed data and an in-memory store, so nothing is saved. See [PLAN.md](../PLAN.md) sections 7 and 10.

**Done when:** you can rebuild last wedding on a phone and compare it with the paper sheet.

Baseline on 2026-10-30: commit `c65d734`, pushed, clean tree, live site serving, `npm run check` and `npm run test:coverage` both passing on Node 24.

## Decisions needed before I start

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | **Add `vue-router`?** It is optional in section 2, so I'm asking first. It would use hash URLs, which work on GitHub Pages. | **Yes.** Without it, the phone's back button leaves the app instead of going back a step, and Phase 7 needs `#/shared/<id>` anyway. |
| 2 | **What goes in the seed data?** It ships in the public app, so no client details. "Rebuild last wedding" also needs real recipes, flowers and prices to mean anything. | Start from the Phase 1 fixtures, then replace values as your mum confirms them. Invented prices stay clearly marked. |
| 3 | **Where can a user change supplier?** The engine supports overrides and stale alternatives, but section 7 has no screen for them. | **On the review screen:** tap an order line to pick another supplier. Stale prices are shown flagged. |

## Data needed by the end of the phase

Development can start without these, but the "done when" can't be met until they're in:

- The seven open questions in [phase-1.md](phase-1.md).
- The rest of the roughly 15 designs. Appendix A lists 11.
- Which roles each flower can fill, and any foliage. Appendix A has no foliage and doesn't give roles.
- Real prices, if you want the cost compared as well as the stems. Dahlias, scabious and sunflower will otherwise stay "needs data".

## Files

```
app/
  main.ts, App.vue      Shell, router, bottom tabs
  router.ts             Routes
  seed/seed.ts          Flowers, suppliers, prices, designs, recipes
  stores/catalogue.ts   Seed data
  stores/event.ts       Current event, edits, live allocation
  views/                Events, EventSetup, Designs, Palette, Review, Placeholder
  components/           DesignCard, RecipeEditor, Stepper, SummaryBar, FlowerTick,
                        OrderList, GatherList, Leftovers, WarningList, NeedsDataBadge
  wording.ts            Warning codes to user-facing text
  styles/               Tokens and base styles
engine/index.ts         Also exports `expandPlan` for the live split text
engine/types.ts         Adds gather notes to `EventPlan`
```

Tests sit beside the code they cover, or in `app/**/__tests__/`. If you approve question 1, `package.json` and `package-lock.json` change too.

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first where behaviour is defined, implement, `npm run check` green, then the next one. Component tests cover behaviour, not markup.

### 1. Seed data and catalogue store

- `app/seed/seed.ts` holds flowers, suppliers, prices, designs and recipes, including placeholder Small, Medium and Large recipes.
- Nothing in `app/` imports `fixtures/`.
- The store offers the sizes available for each design, and only passes active suppliers' prices to the engine.

**Tests:** every recipe refers to a real design and flower, every design has at least one size, inactive suppliers' prices are left out.

### 2. App shell and tabs

- Bottom tabs: Events, Prices, Library, Settings. Prices, Library and Settings say what's coming and do nothing else.
- Phone-first layout, tap targets of at least 44px, labelled controls, keyboard use on desktop.
- The back button moves between steps.
- A placeholder app load from the GitHub Pages path still works.

**Tests:** each tab opens its view, and going back returns to the previous step.

### 3. Event setup

- Name, optional date, optional target budget, parsed with `parsePounds`.
- "Start blank" only. "Duplicate event" comes in Phase 4, when events are saved.
- Creating an event copies the settings defaults and recipes in, so plans never share recipes with the catalogue.

**Tests:** an empty name is refused, a bad budget shows an error, and editing an event's recipe leaves the catalogue unchanged.

### 4. Designs step

- One card per design with a size picker, quantity stepper, and an on/off switch for optional designs.
- Sizes are limited to those with a recipe, and changing size copies that size's recipe.
- Tapping a card opens the event's copy of the recipe. Counts can change, and a role can be swapped for a named flower.
- The leftover pool shows a quantity but no recipe.

**Tests:** add a design and see totals change, changing size swaps the recipe, an edit stays inside the event, quantity can't go below 0.

### 5. Palette step

- One section per role that the chosen designs actually use.
- Role-eligible flowers first, with "show all" for the rest, each showing source, bunch size and current price.
- Each tick shows the split live, such as "7 stems across 3 flowers: 2, 2, 2 + 1 floating".
- A flower used in more than one role gets a "shared" badge with its combined stems.
- A collapsed per-design toggle allows "leave this flower out of this design".

**Tests:** unused roles are hidden, ticking updates the split text, the shared badge shows the right total, leaving a flower out changes that design only.

### 6. Sticky summary bar

- Steps 2 and 3 show estimated cost, total stems and spare stems, updated on every change.
- Cost is marked when it leaves out needs-data flowers.
- The label is "spare stems".

**Tests:** figures match the engine's totals after a tick and after a quantity change.

### 7. Review screen

- Order list grouped by supplier, with stems, bunches, spare stems, cost, thin-bunch warnings, subtotals and a grand total.
- Gather list, with an optional note per line.
- Leftovers: spare stems per flower and the vase pool, for information.
- Warnings: unassigned stems, needs-data flowers, stale prices, thin bunches, and "N flowers missing prices".
- Supplier change, if you approve question 3.

**Tests:** the bridal and reception examples show the Phase 1 hand-worked figures, each warning code has wording, and a note stays with its gather line.

### 8. Needs-data badges

- Flowers with no price or bunch size show a badge, can still be ticked, and are left out of cost.

**Tests:** a needs-data flower can be ticked, its stems count, and its cost doesn't.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **`EventPlan` gains `gatherNotes`**, a map of flower id to note, because section 7 needs one and section 5 has nowhere to put it.
2. **Allocation reruns through a Pinia getter**, so screens never calculate totals themselves.
3. **No UI library.** Plain CSS with tokens, which also avoids a dependency.
4. **The clock is read once per change**, then passed to the engine as `now`, so the engine stays pure.
5. **Supplier and flower names are looked up in the app.** The engine keeps returning ids.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
- Steps to try on iPhone and Android, including rebuilding the wedding.
- A timing check on a real phone with the full wedding, because Phase 1's search timing was only measured on a laptop.
- A combined bridal and reception run. Phase 1 tested them separately, so shared bunches will change some figures.
