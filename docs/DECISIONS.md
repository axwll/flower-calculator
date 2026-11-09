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

## 2026-10-30: Phase 5 decisions

- **Phase 5 finishes on the owner's test Sheet,** approved by the owner. Moving to their mum's account waits until her data is confirmed, and means changing `app/config.ts` and redeploying.
- **Deployed as "execute as me, access: anyone" on the test Sheet,** approved by the owner. The API address and shared key are public in `app/config.ts`, as the plan accepts. Anyone can read prices and nicknames, and add reports.
- **`api/` is TypeScript,** built to one file by `vite.api.config.ts`, with no new dependency. `api/src/seedData.ts` is the one file allowed to import from `app/`.
- **`MasterData` lives in `engine/types.ts`,** so the app and backend share one definition.
- **All Sheet cells are plain text,** so Sheets can't rewrite report times or numbers.
- **Voids are extra rows.** The latest row for an id wins, so `Prices` is append-only, and a void is also logged to `Changelog`.
- **An `onEdit` trigger bumps the version,** so a row fixed by hand reaches the app. `Meta` edits are ignored.
- **Master data is cached by version,** and silently skipped if it's over CacheService's size limit.
- **Report ids are made on the phone,** so a retry after a lost reply can't create a duplicate.
- **The offline queue sends in order and stops at the first failure,** so a later price can't overtake an earlier one. Voiding a report that was never sent just cancels it.
- **A refused update is removed and shown to the person,** so it can't retry forever.
- **Price age colours use the engine's freshness,** and the section 5 defaults until thresholds can be edited.
- **The admin key on a phone is kept in `localStorage`,** and in the offline queue until sent. It's only ever sent to the backend.
- **Features were reordered:** the queue and voiding logic were built together ahead of their screens, because reports only reach the server through the queue.
- **Known limit:** the `Prices` tab keeps every row, and all of them are sent to phones, so replies will grow slowly over the years.

## 2026-10-30: Phase 6 decisions

The owner approved the brief and its four recommendations.

- **A variant is a separate design,** copied with all its sizes in one save, because there's one recipe per design and size.
- **Library recipes can store flowers to leave out.** The list is per recipe, not per role line as the brief first said, to match how events already work. It only affects role lines.
- **Changing an event's size adds the new recipe's leave-out list** to the event's own, and removes nothing, because the event can't tell where each entry came from.
- **The backend moves to the owner's mum's account before she enters real data.** This replaces the Phase 5 decision to wait until her data was confirmed. A new Sheet starts from the seed, so anything entered on the test Sheet would be left behind.
- **Thresholds were added to this phase,** because no phase listed them. They're kept per phone, and new events copy them.
- **Design and recipe rows gained `active`, and recipes gained `excludedFlowerIds`.** In the app, `active` is left out unless it's false, so older rows, the seed and cached data all count as in use.
- **`setup` adds missing columns** at the end of the first row and leaves data rows alone.
- **Admin saves aren't queued.** Saving waits for the reply and a refresh, so it can take several seconds.
- **A new design doesn't reach new events until it has a recipe,** because events need one to copy.
- **A leftover pool can't be created or switched off through the app.** Its name, group and in-use setting can be edited.
- **Rules from the brief:** there's no `Changelog` screen, the role list stays in code, a new size starts from a copy of the one showing, new designs appear at the end of their group, and when two admins edit at once the later save wins.
- **`FlowerForm` wasn't needed as a separate component.** The form lives in `FlowerEditView`.
- **Tests were written before the code, but weren't run red first.** Each batch of tests and its code went in together, so the tests haven't been seen failing.

## 2026-10-30: Phase 7 decisions

The owner asked for this phase to start without approving the brief first. They've since confirmed two of these: a purchase stays final unless someone asks for undo, and a share can include the event name, date and budget.

- **A purchase can't be undone.** The plan makes the snapshot immutable, so the confirmation screen does the protecting. Duplicating the event gives a clean copy.
- **`EventPlan` gained `frozenPrices` beside `purchase`.** Allocation reads the list, so "keep frozen prices" on a duplicate works on an event that isn't purchased. The snapshot keeps its own copy, which nothing edits.
- **A frozen flower keeps its frozen price for any extra bunches.** That follows the plan's "stays editable with frozen prices". Only flowers with no frozen price use live prices.
- **Frozen prices ignore supplier overrides** and are never flagged as stale.
- **A flower with no price at purchase counts as added** once it gets one, because it wasn't bought at a known price.
- **"Spent at purchase" never goes down.** Bought bunches stay bought, so Review shows the snapshot's total plus what edits add, not a reworked total.
- **"Price changed since viewed" is a notice on Review.** The event stores the prices last seen, and "Got it" clears the notice. A supplier picked by hand doesn't count, and neither does a move caused by changing stems.
- **The notice waits for saved prices,** so the seed's invented prices are never recorded as seen. Only the very first offline run can record them.
- **Backup nudges only follow a purchase,** as section 8 asks. It's a link to Settings, shown once.
- **The event schema stays at version 1.** The new fields are optional, as `gatherNotes` was. `migrateEvent` checks them on load, restore and share.
- **A shared plan is previewed first,** so opening a link can't quietly add anything.
- **Shared plans keep their purchase and frozen prices,** and get a new id and `sharedFrom`. Opening the same link again offers your copy or another.
- **The Events tab gained "Open a shared link".** iPhone links open in Safari, whose storage is separate from the installed app, so the plan wouldn't otherwise reach the app. This wasn't in the plan.
- **A share holds the whole event,** including its name, date and budget, as the plan says. The share screen warns about this. It replaces Phase 5's "no client data goes in the Sheet". Shares can't be listed, and each id is a random UUID.
- **The backend makes the id with `Utilities.getUuid()`.** It needs no new permission, so `setup` doesn't need running again.
- **A share doesn't bump the data version or write to `Changelog`,** because master data hasn't changed.
- **Sharing is capped at 50,000 characters compressed and 2 MB unpacked.** The second limit protects the phone opening it.
- **`ApiClient` gained `sharePlan` and `fetchShared`.** `offlineClient` is now exported, so test clients inherit them.
- **Printouts are unchanged.** They show what to make, not what was bought.
- **Tests were written and run failing first** for each batch, unlike Phase 6.

## 2026-11-02: Owner's notes after Phase 7

- **Events can be deleted.** The owner asked for this, reversing "delete event" being out of scope. It sits at the bottom of Review, behind a confirmation. It can't be undone, and it isn't tracked anywhere else.
- **Storage is deleted first,** so an event that couldn't be removed stays on screen rather than coming back on the next launch.
- **Deleting doesn't reach anything already sent.** Shared links and other people's copies stay, and a restored backup brings the event back.
- **The icon is now a calculator with a flower on its screen,** replacing the placeholder flower. The source is `docs/icon.svg`. Everything sits inside the maskable safe area, so one drawing serves every size.
- **The home screen name is "Flower Calc".** The owner asked for a new name without choosing one. "Flower Calculator" would be cut short on an iPhone. The full name stays as the app's title. iPhones also need the `apple-mobile-web-app-title` tag.

## 2026-11-02: Owner's flow review

- **Every subpage has one "Back to…" link at the top left.** It goes to the screen's parent, not browser history, because a shared link or an installed app may have no history. The four tabs have none.
- **A price opened from a flower goes back to that flower,** and one opened from Shop mode goes back to Shop mode.
- **Save buttons stay grey until something changes.** This covers suppliers, flowers, designs, recipes and thresholds. Copy design and Save as a new design stay grey until they have a name.
- **Save price stays on.** Saving the same price is a real report, because it confirms the price and resets its age.
- **A new size can be saved straight away,** because its copied recipe is new even though nothing has been edited.
- **Leaving unsaved changes asks first.** Back links make this easy to do by accident. Changing sizes on a design doesn't ask, and still drops unsaved recipe edits.
- **Only the button doing the work changes its label.** Others grey out, and copying a design says "Copying…".
- **Design and recipe saves now confirm with a message,** because the page stays put and the button only goes grey.
- **Disabled buttons had no grey style before this,** so the rule is global.
- **All tappable list rows use the same card style,** with a shadow and a chevron, so they no longer look like inputs.
- **Save as PDF now shows feedback, but the cause on phones is not confirmed.** The button says "Opening…". If the browser doesn't report the print screen opening within 1.5 seconds, it explains a route through Safari. Printing from an installed iPhone app couldn't be tested here, so a real fix waits on knowing which phone failed.

## 2026-11-02: Mixed sizes, budget commas and countdown

- **An event can hold several sizes of one design.** This replaces "one card per design" from Phase 2, which the owner found wouldn't cover 3 Large and 4 Small pedestals. "Add another size" adds a second card beside the first, with its own quantity and recipe, and a design can't have two cards of the same size.
- **Every design keeps at least one card.** Removing a card with placements asks on the card, not in a pop-up, because a browser can silently block pop-ups.
- **Purchase flags match on design and size.** A card switched to another size still shows as changed, and a size added afterwards shows as added.
- **The favicon has its own simpler drawing,** `docs/favicon.svg`, because the app icon blurs at tab size. The icon had still been the default Vue logo until now.
- **The app asks its own questions.** Browser pop-ups can be silently blocked, which would make a button or Back link seem dead, so every `window.confirm` became an in-app panel with named answers. Print-only `.no-print` rules keep it off printouts.
- **Screens that list designs name the size only when an event has two cards of a design,** such as "Pedestals (Small)".
- **The budget box adds commas as you type,** and keeps the cursor beside the same digit. Price boxes don't, as prices are small.
- **Event cards show the date with a greyed countdown,** such as "30 Nov 2026 in 28 days", counted in calendar days.

## 2026-11-02: Fixes from the full test run

- **On iPhones and iPads, Save as PDF now builds a real PDF file and opens the share screen,** with Print and Save to Files. This replaces the 'Opening…' fallback above, and goes beyond the plan's "print stylesheet plus the browser's Save as PDF". Tested on a bare page in an installed iOS 27 app, `window.print()` did nothing from the page, a hidden iframe or a window the app opened, and a shared HTML file offered no Print. A shared PDF file was the only route that worked. Safari has the same route because it blocked a second `window.print()` and sometimes ignored the first.
- **The PDF needs no library.** `app/print/pdf.ts` writes a text-only PDF using Helvetica, which every viewer has. Characters outside its Western European set print as `?`, such as emoji or Greek. Other browsers still use `window.print()` and the print stylesheet, so there are two layouts to keep in step.
- **The screen and the PDF share their words** through `app/print/content.ts`, so they can't drift apart. The PDF follows the printout: "Work plan" as its title, no event name, client details or quote, and the same one-design-per-page and flower table options. The file is always `work-plan.pdf`, as an event name could contain a client's name.
- **The print help no longer mentions the installed app or Safari,** because it now only shows outside iPhones. It also goes away if the print screen opens late, as it does after a browser's "allow printing?" question.
- **A flower waiting for a price stays out of "added after purchase"** until it has one, as the earlier decision intended. `PurchaseChange` now carries `unit` instead of `soldAs`, because a bunch-sold flower with no price is counted in stems.
- **Voiding a price that's already being sent now queues a void behind it.** The send can't be called back, so removing it from the queue left the price live. The price stays visible until the void goes through. If the Sheet refuses that report, the void is refused too and shows its own message.
- **A card keeps its size box once every size is on the event,** even with nothing to switch to, so each card still says which size it is.
- **The Events tab stays highlighted on shared link screens,** as they're reached from Events.


## 2026-11-09: Feedback from first use

- **A new flower, supplier or design keeps its id until it's saved.** Each press of Save used to make a new id, so if a save reached the Sheet but its reply was lost, pressing Save again added a second copy. The same applied to "Make a variant" and "Save as a new design". The id is forgotten once saved, so the next new item gets its own.
- **Designs added to the library later join events that aren't purchased,** at zero placements, so nothing changes until they're used. This replaces "existing events keep their own designs" for new designs only: recipes already in an event are still that event's own copy. Retired designs aren't added, and nothing is added while the app only has its built-in starting data, as the saved data may have retired some of it. Purchased events stay as they were.
- **Renamed for the florist:** a design's "group" is now "Location", a "recipe" is now a "stem count", and the Library's "Recipes" section is now "Design types". Only the words on screen changed. The data and code keep their old names, so nothing in the Sheet moves.
- **In use, Optional and Warn about thin bunches each have a line saying what they do.** The labels stay the same.
- **"Open a shared link" has a "Paste and open" button.** A link opened on an iPhone or iPad goes to Safari, not the installed app, so it has to be pasted in anyway. Copying on a Mac reaches an iPad's clipboard by itself (Universal Clipboard, on macOS Monterey too), so one tap opens it. If the clipboard can't be read, it says to paste into the box instead.
- **Settings ends with a small version stamp,** such as "Version 1.0.0", so the owner can see which build a device is running. The version is `package.json`'s, set at build time and following semver. This release is 1.0.0, the first to be numbered.
