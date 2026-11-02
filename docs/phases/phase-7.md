# Phase 7 brief: Purchase and sharing

Status: **built, awaiting owner review.** The owner asked for this phase to start without approving the brief first. They've since confirmed decisions 1 and 7. The backend is deployed to the test Sheet.

Goal: an event's prices can be frozen when the flowers are bought, and a plan can be sent to someone else's phone. See [PLAN.md](../PLAN.md) section 8.

**Done when:** a shared plan opens on another phone with its frozen prices intact.

Baseline on 2026-10-30: commit `4b77b57` on `main`, not pushed, with `npm run check` passing 727 tests. Phase 6 hasn't had its owner review or Sheet checklist yet.

## Decisions made without asking

| # | Question | Decision |
| --- | --- | --- |
| 1 | **Can a purchase be undone?** | **No.** The plan makes the snapshot immutable, so the confirmation screen does the protecting. Duplicating the event gives a clean copy if it was a mistake. |
| 2 | **What can a purchased event's flowers cost?** | **A frozen flower keeps its frozen price, even for extra bunches.** That's the plan's "stays editable with frozen prices". A flower with no frozen price uses live prices. |
| 3 | **Does the amount spent go down if an edit needs less?** | **No.** Review shows the amount spent at purchase, and what any edits add. Bought bunches stay bought. |
| 4 | **What is "price changed since viewed"?** | **A notice on Review.** It compares the event's prices in use with those from the last time someone looked, until they tap "Got it". |
| 5 | **Does a shared plan need a preview?** | **Yes.** Opening a link shows the plan first, and "Add to my events" imports it, so a link can't quietly add anything. |
| 6 | **How does an installed iPhone app open a link?** | **By pasting it.** iPhone links open in Safari, whose storage is separate from the installed app, so the Events tab gains "Open a shared link". |
| 7 | **What goes in a share?** | **The whole event, as the plan says,** including its name, date and budget. The share screen warns that anyone with the link can see them. |

## What you'll need to do

1. **Nothing in the Sheet.** The `SharedPlans` tab already exists, and `setup` isn't needed for this phase.
2. **Run the Sheet checklist,** and the two-phone test below.

## How it fits together

- **The event holds its frozen prices** as well as the snapshot. Allocation reads the event's list, so "keep frozen prices" on a duplicate needs no purchase on the copy.
- **The snapshot is never edited.** It's a plain copy made once, and every edit goes to the working event.
- **Sharing needs a connection.** The phone compresses the event and sends it. The backend stores it and returns a long random id.
- **A share is a copy.** There's no link back to the original, so changes never travel either way.
- **A shared plan can't be listed.** The backend hands one back only to someone who has its id, and the data reply never includes shares.

## Files

```
engine/types.ts                  FrozenPrice, PurchaseSnapshot, event fields
engine/purchase.ts               Frozen offers, snapshot, purchase and price differences
engine/allocate.ts               Uses frozen prices
app/storage/migrations.ts        Checks purchase data on load, import and share
app/share/codec.ts               gzip and base64url
app/api/client.ts                sharePlan, fetchShared
app/stores/event.ts              Purchase, duplicate options, price notice, shared import
app/views/PurchaseView.vue       What will be frozen
app/views/SharedView.vue         Opens a shared plan
app/views/ReviewView.vue, EventsView.vue, EventSetupView.vue, EventLayout.vue
app/components/                  OrderLine, DesignCard, PriceChanges, SharePlan, PurchaseSummary
api/src/core.ts, api/src/main.ts sharePlan and the shared read
```

## Features, acceptance criteria and tests

Each feature follows the plan's loop, and this time each batch of tests is run failing first.

### 1. Frozen prices in the engine

- A flower with a frozen price uses it, whatever live prices do: newer, voided, expired, stale or from a retired supplier.
- Frozen prices aren't flagged stale, and supplier overrides don't apply to them.
- Flowers with no frozen price behave as before.

**Tests:** each case above, and that an event with no frozen prices allocates exactly as before.

### 2. Purchase snapshot

- The snapshot holds recipe copies, palette, allocation, settings, the time, and each resolved price: supplier, price, bunch size, report date and report id.
- Foraged and needs-data flowers have no frozen price.

**Tests:** contents, no shared references, and flowers with no stems left out.

### 3. Mark as purchased

- Review gains "Mark as purchased". The next screen lists every price that will be frozen, its age, and any flowers with no price to freeze.
- Confirming stores the snapshot and offers a backup straight away, as section 8 asks.
- An event can only be purchased once.

**Tests:** the list, flowers with no price, confirming, a second attempt, cancelling, and the backup prompt.

### 4. After purchase

- Events and the event header show "Purchased".
- Review shows the amount spent and any added cost.
- Lines that need more than was bought show "Added after purchase". Design cards show added or changed.
- The supplier picker is replaced by "Frozen price" on frozen lines.

**Tests:** the snapshot unchanged after edits, frozen and live flowers, extra bunches, fewer stems, and design flags.

### 5. Duplicate

- Purchase state is always cleared. Prices reset to live by default, with a "Keep frozen prices" option.

**Tests:** both choices, and a copy with kept prices can still be purchased.

### 6. Storage

- Bad purchase data is refused on load, restore and share, like any other bad event.
- Older events stay valid with no migration, as the new fields are optional.

**Tests:** old events, good and bad purchase data, and a backup round trip.

### 7. Price-changed notice

- Review lists flowers whose price has changed since it was last viewed, with old and new prices.
- A price change or a move to a new supplier counts. A supplier picked by hand, or a move caused by changing stems, doesn't.
- Frozen flowers never appear. "Got it" clears the notice.

**Tests:** first view, a change, a new supplier, a hand-picked supplier, changed stems, frozen flowers, and "Got it".

### 8. Backend

- `sharePlan` needs the shared app key, refuses anything too large or malformed, and returns a long random id.
- `doGet?shared=<id>` returns that plan or "not found". It doesn't bump the data version.

**Tests:** wrong key, too large, bad characters, the round trip, an unknown id, and an unchanged version.

### 9. Compression and client

- gzip plus base64url with `CompressionStream`, with no library.
- Decoding stops at a size limit, so a bad share can't exhaust a phone.

**Tests:** round trip, a purchased event fits the limit, corrupt data, and an oversized plan.

### 10. Share and open

- Review gains "Share this plan". It gives a link to copy or send, warns who can see it, and explains a failure.
- `#/shared/<id>` previews the plan. Importing makes a copy with a new id, frozen prices intact.
- The Events tab gains "Open a shared link", which takes a pasted link.
- Opening a link you already have offers your copy or another one.

**Tests:** success, no connection, too large, preview, import, not found, no connection, a newer app's plan, pasted links, and repeat opens.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **The event schema stays at version 1.** The new fields are optional, as `gatherNotes` was.
2. **Each share is a new row with a new id.** Sharing twice gives two links.
3. **Sharing doesn't bump the data version,** because master data hasn't changed.
4. **A share leaves out the sharer's price-viewed record,** so the other phone starts fresh.
5. **Work plans and printouts don't change.** They show what to make, not what was bought.

## Out of scope

Revoking shares, sending changes back, viewing friends' plans, live collaboration, undoing a purchase, and backup nudges beyond the one after a purchase. Nudges and the budget screen are Phase 8.

## Known risks

- **Shares are readable by anyone with the link.** The id can't be guessed, but the plan holds the event name and budget. This changes Phase 5's "no client data goes in the Sheet", which is why the share screen warns about it.
- **The share tab has no size control overall.** Anyone with the public app key could add rows, as with prices.
- **iPhone keeps Safari and the installed app apart,** so a tapped link lands in Safari unless it's pasted into the app.

## Manual checklist for the Sheet

Run on your test Sheet:

- [ ] Sharing adds one row to `SharedPlans`, and no row anywhere else.
- [ ] The data version in `Meta` doesn't change.
- [ ] The link opens the plan on a second phone.
- [ ] A made-up id shows "not found".

## Two-phone test

1. On phone one, build an event, mark it as purchased, and share it.
2. On phone one, report a new price for one of its flowers.
3. On phone two, open the link and add the plan.
4. Check that the price and total match phone one's purchase, not the new price.
5. On an installed iPhone app, paste the link into "Open a shared link" on the Events tab.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
