# Phase 5 brief: Backend and prices

Status: **built, awaiting owner review.** The real backend needs the owner's one-time authorisation before the Sheet checklist and two-phone test can run.

Goal: a Google Sheet holds the shared data, and anyone with the app can update a price that everyone else then sees, including from a phone with no signal. See [PLAN.md](../PLAN.md) sections 7 and 9.

**Done when:** a friend updates a price on their phone and your mum sees it.

Baseline on 2026-10-30: commit `b4103fb` on `main`, with `npm run check` passing on Node 24. The Apps Script project exists, bound to your test Sheet, with no code in it yet.

## Decisions needed before I start

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | **When does this move to your mum's Google account?** The plan says after developing on your test Sheet. The Sheet is seeded from `app/seed/seed.ts`, which is still partly guesswork. | **After her data is confirmed.** Phase 5 finishes on your test Sheet, and the "done when" test runs there. Moving later means changing one config value and redeploying. |
| 2 | **Am I allowed to deploy to your test Sheet?** Deploying creates a public web address, set to "execute as me, access: anyone", as the plan requires. | **Yes, for the test Sheet only.** Anyone with the address and the key can read prices and add reports, and both are public in the repo. No client data goes in the Sheet. |

## What you'll need to do

I can do almost everything through clasp, but these need you:

1. **Approve the script once.** Open the Apps Script editor, run `setup`, and accept Google's permissions. Google shows an "unverified app" warning, because this is your own private script, not a published one. That's expected.
2. **Set the admin key.** Pick one and add it as `ADMIN_KEY` under Project Settings, then Script Properties. Don't send it to me.
3. **Run the two-phone test** at the end.

## How it fits together

- The app keeps working if the backend is down. It shows master data from its last fetch, or from the seed on a first run with no connection.
- All Sheet access goes through a small interface, so nearly all backend logic is tested locally without Google.
- Price reports get their id on the phone. If a reply is lost and the phone sends the report again, the backend ignores the repeat.

## Files

```
api/src/core.ts           Pure logic: rows to data, validation, void rules, versions
api/src/core.test.ts      Tests for that
api/src/sheet.ts          The Google-facing layer
api/src/main.ts           doGet, doPost, setup
api/src/seedData.ts       Built from app/seed/seed.ts, so there's one source
api/appsscript.json       London time zone and web app settings
app/config.ts             API address and shared app key, public by design
app/api/client.ts         Talks to the backend
app/storage/              Adds cached master data and the offline queue
app/stores/catalogue.ts   Loads cached data, then refreshes
app/stores/prices.ts      Reporting, voiding and the queue
app/views/PricesView.vue, app/views/ShopView.vue
app/components/           PriceForm, PriceAge
app/views/SettingsView.vue  Nickname
eslint.config.ts, tsconfig, package.json  Build and boundary rules for api/
```

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first where behaviour is defined, implement, `npm run check` green, then the next one.

### 1. Backend build and core logic

- Backend code is TypeScript, shares the engine's types, and builds to one file for Apps Script using the Vite already installed. There's no new dependency.
- `api/` can't import from `app/`, or use the DOM.

**Tests:** the built file exposes `doGet`, `doPost` and `setup`, and the boundary rule rejects a bad import.

### 2. Sheet setup

- `setup` creates every tab and header from section 9 and seeds starting data, so a fresh Sheet on another account is one run.
- Running it twice changes nothing.
- Tabs stay readable, with no JSON blobs except `SharedPlans`.

**Tests:** seed rows round trip back to the same data, and a second run adds nothing. The rest is on the manual checklist.

### 3. Reading master data

- `doGet?since=<version>` returns "unchanged" or the full data, with the latest row per id.
- Reads use CacheService.
- The app sends `text/plain` JSON on writes, to avoid the CORS preflight Apps Script can't handle.

**Tests:** unchanged and changed versions, latest row wins, and inactive rows are kept.

### 4. Writing price reports and voids

- `doPost` takes an `action`. Every write uses LockService, is append-only and bumps the version.
- Reports need the shared app key, and are validated on the server.
- Anyone can void their own report, matched by nickname, and the admin key can void any.
- A void adds a row and removes nothing, so the previous price returns on its own.
- Code comments say plainly that the shared key is a speed bump, not security, and the same goes for nicknames.

**Tests:** wrong key, bad data, a repeated report id, voiding your own, someone else's and with the admin key, and the version bump.

### 5. First deployment

- I push to your test project and deploy, then you do the one-time steps above.
- The API address and shared key go in `app/config.ts`.

**Checks:** the manual checklist below.

### 6. App loads live data

- On start the app shows cached master data, then refreshes in the background.
- With no cache or connection it falls back to the seed, and says the data may be old.
- Inactive suppliers stay out of prices, as now.

**Tests:** first run, cached run, unchanged reply, failed request, and a bad reply leaves the cache alone. These use a fake server.

### 7. Nickname and Prices tab

- Settings gains a nickname, needed before reporting a price.
- A searchable flower list shows the latest price per supplier and its age, amber at 14 days and red at 30.
- Tapping a flower opens a prefilled form: supplier, price, stems per bunch, note and optional offer-ends date.
- A change over 50% asks first: "Was £10, now £100. Is that right?"

**Tests:** search, age colours at their boundaries, prefilled values, validation, pounds parsing, and the confirmation at and just over 50%.

### 8. Shop mode

- Pick a supplier and see their flowers with last prices, tapping one to update it.
- An update should take under 10 seconds. The app saves it at once and sends it in the background, so a slow reply doesn't hold anyone up.

**Tests:** only that supplier's flowers show, and an update returns to the list. Timing goes on the manual checklist.

### 9. Voiding

- People can void their own reports from the flower's page. An admin key on the phone allows voiding any.
- The previous price returns straight away.

**Tests:** the void button shows only where allowed, and the price falls back after a void.

### 10. Offline queue

- With no connection, a report goes into a saved queue and shows "pending sync".
- It sends with its **original** timestamp.
- Retries happen when the app opens and on the `online` event, not through iOS background sync.
- A report the server refuses stops retrying and is shown to the person.

**Tests:** queued while offline, sent on reconnect, original timestamp kept, survives a reopen, no double send, and a refused report.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **Report ids are made on the phone,** so retries can't create duplicates.
2. **Reports show at once on the phone that made them,** marked "pending sync" until sent.
3. **The seed stays in the app** as the first-run fallback, and also fills the Sheet.
4. **The admin key is kept in Script Properties** and checked only on the server. It's typed into a phone's Settings and never appears in the Sheet or the repo.
5. **Editing thresholds stays out of this phase.** Ages use the section 5 defaults until Settings is finished.

## Out of scope

Recipe, flower and supplier editing (Phase 6), shared plans (Phase 7), quantity deals, user accounts, and notices when a price changes after you've viewed it (Phase 7).

## Known risks

- **Slow first reply:** Apps Script can take a few seconds to wake up. Cached data and background sending should hide this.
- **Public write access:** anyone who reads the repo could add price reports. That's what the plan accepts, and voiding is the remedy.
- **The Google-facing layer** can only be tested by hand, using the checklist below.

## Manual checklist for the Sheet

Run on your test Sheet once deployed:

- [ ] `setup` creates all nine tabs, and running it again adds nothing.
- [ ] The app loads flowers and prices from the Sheet.
- [ ] A price report appears as a new row with the right values.
- [ ] A second phone sees the new price after refreshing.
- [ ] Voiding adds a row, and the previous price returns.
- [ ] A wrong app key is refused.
- [ ] Voiding someone else's report without the admin key is refused.
- [ ] A report made in airplane mode shows "pending sync", then arrives once back online, with its original time.
- [ ] Fixing a row by hand in the Sheet shows up in the app.

## Phase end

- Plain-English summary, `git status` and `git diff --stat`, deviations and open questions.
- The two-phone steps for the "done when" test, on iPhone and Android.
