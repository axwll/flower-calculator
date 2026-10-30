# Phase 6 brief: Admin

Status: **built, awaiting owner review.** The owner approved this brief and its four recommendations on 2026-10-30. The backend is deployed to the test Sheet, and `setup` still needs running once.

Goal: your mum can look after the master data from her phone: recipes, designs, flowers and suppliers, with every change logged. See [PLAN.md](../PLAN.md) sections 7 and 9.

**Done when:** mum creates a "no dahlia" buttonhole variant without help.

Baseline on 2026-10-30: commit `b20e999` on `main`, with a clean working tree. The Phase 5 two-phone test is still outstanding. This phase doesn't depend on its result, but any problem it finds would need fixing alongside this work.

## Decisions needed before I start

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | **What is a "variant"?** The plan allows one recipe per design and size, and sizes are a fixed list. | **A separate design,** such as "Buttonholes (no dahlia)", copied from the original with all its sizes. It shows as its own card when planning. |
| 2 | **How does a variant leave out a flower on a role line?** A named flower can just be removed. A "focal" line has no flower to remove, and only events can currently leave a flower out. | **Library recipes can also store flowers to leave out.** New events copy that list, using the same "leave this flower out of this design" behaviour events already have. |
| 3 | **When does the backend move to your mum's account?** We agreed to wait until her data was confirmed. But once the Library exists, the Sheet holds the real data, and a new Sheet starts from the seed, so anything entered on the test Sheet would be left behind. | **Move before she enters real data.** Build and rehearse on the test Sheet, then move, then she types in her remaining designs and corrections in the app. |
| 4 | **Should thresholds go in this phase?** The plan puts them in Settings, but no phase lists them, and Settings still says "Coming later". | **Yes, as the last feature.** They're small, and otherwise they drop through the gap. |

## What you'll need to do

1. **Run `setup` once more** in the Apps Script editor after I deploy. It adds the new columns to your test Sheet without touching existing rows.
2. **Enter your admin key** in Settings on your phone. Don't send it to me.
3. **Run the Sheet checklist** and sit with your mum for the "done when" test.

## How it fits together

- **Admin edits need a connection.** They aren't queued, because mum should know straight away whether a change saved. Prices keep working offline as before.
- **The admin key is checked by the server,** on every write. Hiding the Library on the phone is only tidiness.
- **Ids are made on the phone** and readable in the Sheet, such as `dahlia-peachy-x7f2`. Saving twice after a lost reply just adds a harmless newer row.
- **Nothing is deleted.** Every edit adds a row, and things no longer wanted are retired.
- **Existing events never change.** They keep their own recipe copies, as the plan requires. Edits reach new events only.

## Files

```
engine/types.ts                 Design.active, Recipe.active, Recipe.excludedFlowerIds
api/src/core.ts                 Admin actions, validation, Changelog, new columns
api/src/core.test.ts            Tests for that
app/api/client.ts               New actions
app/stores/library.ts           Admin saves, then refreshes the catalogue
app/stores/catalogue.ts         Hides retired designs and recipes from new events
app/stores/event.ts             Copies leave-out lists, saves a recipe to the Library
app/router.ts                   Library routes
app/views/LibraryView.vue, FlowerEditView.vue, SupplierEditView.vue, DesignEditView.vue
app/components/                 LibraryRecipeEditor, SaveToLibrary
app/components/RecipeEditor.vue "Save to library" for admins, retired flowers hidden
app/views/SettingsView.vue      Key check, thresholds
```

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first where behaviour is defined, implement, `npm run check` green, then the next one.

### 1. Admin key check

- Settings gains a "Check key" button that asks the server. The phone shows "Admin on" or "That key isn't right".
- Admin screens show only after a successful check.
- If a later save is refused for the key, the phone turns admin off and says why.
- A nickname is needed, because it goes in the `Changelog`.

**Tests:** right key, wrong key, no key set on the server, no connection, and a key that stops working.

### 2. Sheet columns

- `Designs` gains `active`. `Recipes` gains `active` and `excludedFlowerIds`.
- `setup` adds any missing column at the end of a tab and leaves rows alone.
- Rows from before this change count as active.

**Tests:** old rows read as active, a second `setup` changes nothing, and round trips keep the new values.

### 3. Admin writes

- New actions: `saveFlower`, `saveSupplier`, `saveDesign` and `saveRecipe`.
- Each one needs the admin key, uses the lock, appends rows, bumps the version and writes a readable `Changelog` line.
- The server sets recipe versions. A recipe needs at least one line with whole stems above zero, and known flowers and roles. Leftover pool designs have no recipe to edit.

**Tests:** no key, wrong key, bad data per action, an unknown flower or design, version numbers, latest row wins, and the `Changelog` lines.

### 4. Deployment

I push to your test project and update the existing deployment, so the web address stays the same. You then run `setup`.

**Checks:** the manual checklist below.

### 5. Library tab

- Admins see Recipes, Flowers and Suppliers. Everyone else sees a short note saying this is for the admin, and the tab stays where it is.
- Saves show "Saving…", block a second tap, and leave the form filled in if they fail.

**Tests:** admin and non-admin views, a failed save keeps what was typed, and a successful save updates the lists.

### 6. Flower editor

- Add or edit a flower: name, colour, roles, sold as, track leftovers, active.
- A new flower shows as needs data until someone reports a price, with a link to the price form.
- Changing "sold as" warns that existing prices may need updating.
- Retired flowers stay in existing events, but can't be picked for new work.

**Tests:** add, edit, at least one role needed, retire, and a retired flower missing from the palette and swap lists.

### 7. Supplier list

- Add or edit a supplier: name, type, active.
- Retiring one removes its prices from use, as inactive suppliers already do. Old rows stay.

**Tests:** add, edit, retire, and its prices no longer applying.

### 8. Designs and recipes

- Add or edit a design: name, group, optional, active.
- The recipe editor adds and removes lines, picks a role or a named flower, sets stems, and shows total stems.
- A role line can list flowers to leave out.
- Add a size, starting from a copy of an existing size, or retire one. Fixed can't sit alongside Small, Medium or Large.
- Saving says plainly that existing events won't change.

**Tests:** line editing, validation, sizes, retiring, and an existing event unchanged while a new event gets the new recipe, including its leave-out list.

### 9. Copy a design

- "Make a variant" copies a design and all its sizes under a new name, ready to edit.

**Tests:** new id, every size copied, and the original unchanged.

### 10. Save to library

- In an event's recipe, admins can tap "Save to library", and choose "Update this recipe" or "Save as a new design".
- It saves the event's lines and leave-out list for that design. Lines at zero stems are dropped.
- If there's no connection, the event is untouched and the phone says it couldn't save.

**Tests:** both choices, zero lines dropped, non-admins don't see it, and a failed save.

### 11. Thresholds (if approved)

- Settings edits thin-bunch percent, price amber and red days, and big-change percent, with the section 5 defaults.
- They're kept per phone. New events copy them in, and existing events keep their own.
- Price ages and the big-change check use them.

**Tests:** ranges, saving, new and existing events, and the colour and confirmation boundaries.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **There's no in-app `Changelog` screen.** The plan only asks for it to be written, and it's readable in the Sheet.
2. **The role list stays in code,** as section 4 says only you edit it.
3. **Adding a size starts from a copy.** It's the simple version of the "copy from another size" idea in section 14, whatever mum's example shows.
4. **New designs appear at the end of their group.** There's no reordering.
5. **Two admins editing at once isn't handled.** The later save wins, and both are in the `Changelog`.

## Out of scope

Editing the role list, reordering, restoring old recipe versions, a `Changelog` screen, delete event, purchases and sharing (Phase 7), and nudges and the budget check (Phase 8).

## Known risks

- **Saves are slow.** Writes took about 4 seconds in Phase 5, and there's no background sending here, so mum will see "Saving…" each time.
- **The Sheet layer is hand-tested.** The new `setup` step can't be proved locally.
- **The `Prices` limit from Phase 5 is unchanged.** Admin edits add few rows, so they barely affect it.

## Manual checklist for the Sheet

Run on your test Sheet once deployed:

- [ ] Running `setup` again adds the new columns, and no rows change.
- [ ] Running `setup` once more after that changes nothing.
- [ ] The right admin key shows "Admin on", and a wrong one is refused.
- [ ] Adding a flower adds a row and a `Changelog` line.
- [ ] Editing a recipe adds a new version, and a second phone sees it after reopening.
- [ ] An event made before the edit keeps its old recipe.
- [ ] A new event gets the edited recipe.
- [ ] Retiring a design hides it from new events.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
- The "done when" steps for your mum. The seed Buttonholes recipe has no dahlia in it, so the rehearsal uses Groom, which does, unless her real buttonhole recipe is in by then.
