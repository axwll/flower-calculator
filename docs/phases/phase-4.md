# Phase 4 brief: Persistence and PWA

Status: **built, awaiting owner review.** You asked me to start without waiting for approval this one time, so review this brief with the finished work. Device checks are still to do.

Goal: events survive closing the app, and the app works offline and installs to a phone's home screen. See [PLAN.md](../PLAN.md) sections 8 and 10.

**Done when:** events survive closing the app and work offline on both iPhone and Android.

Baseline on 2026-10-30: commit `bcb1628` on `main`, with `npm run check` passing on Node 24.

## New dependencies

`dexie` and `vite-plugin-pwa`, both listed in section 3 for this phase. Nothing else.

I'm not adding `fake-indexeddb`, because it isn't listed and I can't ask you. Storage sits behind a small interface, so tests use an in-memory version, and the real IndexedDB layer is checked in Chrome instead.

## Files

```
app/storage/migrations.ts   Schema versions and event validation
app/storage/repository.ts   Storage interface and in-memory version
app/storage/dexie.ts        IndexedDB version
app/storage/backup.ts       Build and read backup files
app/storage/persistence.ts  Ask the browser to keep the data
app/install.ts              Work out which install help to show
app/stores/event.ts         Loads and saves events, duplicate, import
app/views/SettingsView.vue  Backups and install help
app/components/InstallGuide.vue
app/router.ts, app/App.vue, app/main.ts
public/                     App icons
vite.config.ts, index.html  PWA setup
```

## Features, acceptance criteria and tests

Each feature follows the plan's loop: tests first where behaviour is defined, implement, `npm run check` green, then the next one.

### 1. Migrations and validation

- Every event passes through one migration function when it is loaded or imported, from day one.
- Migrations run in order from the event's `schemaVersion` to the current one.
- An event from a newer version of the app, or one that isn't a valid event, is refused with a clear reason.

**Tests:** current version unchanged, a chain of steps runs in order, newer versions refused, malformed data refused.

### 2. Saving and loading

- Events load on start, and every change saves straight away.
- A deep link or reload into an event waits for loading, then opens it.
- A failed save or load shows a clear message. A stored event that can't be read is skipped and counted, and is never deleted.

**Tests:** a reload brings events back, edits are saved, opening an event after reload works, save and load failures show, a bad record is skipped.

### 3. Duplicate event

- The new event screen can start blank or from an existing event.
- A duplicate copies recipes, palette and quantities into a separate event with a new id.
- Frozen prices don't exist until Phase 7, so the "keep frozen prices" option arrives then.

**Tests:** a duplicate has the same designs and palette, editing it leaves the original alone, and the new name, date and budget apply.

### 4. Export and import

- Settings can export every event to one JSON file, and import one to restore.
- Import is all or nothing: if any event is invalid, nothing changes.
- Import merges by id. If it would replace existing events, it asks first.

**Tests:** a backup round trip, wrong file, broken JSON, invalid event, confirm before replacing, and a cancelled import changes nothing.

### 5. PWA and offline

- Manifest, icons and a service worker that precaches the whole app.
- After one online visit, the app opens with no network.
- New versions install automatically.

**Checks:** the build produces the manifest and service worker, and in Chrome the app loads offline and events are still there.

### 6. Persistent storage and install guidance

- The app asks the browser to keep its data, and Settings shows the result.
- A first-run guide on Events: an install button on Android where the browser allows it, a step-by-step Add to Home Screen walkthrough on iPhone, and nothing once installed.
- It can be dismissed, and reopened from Settings.

**Tests:** the right guide for iPhone, iPad, Android and desktop, nothing when installed, dismissal is remembered, and the storage status shows.

## Rules I will add unless you object

Each will go in `DECISIONS.md`.

1. **Backup nudges wait for Phase 7,** because the plan ties them to purchases.
2. **Import never removes events.** It adds new ones and replaces same-id ones, after asking.
3. **Saves are not debounced.** Each change writes straight away, so nothing is lost if a phone closes the app.

## Not in this phase

- **Deleting an event.** The plan doesn't list it, so I've left it out, but events now last forever, including test ones. This is a question for you at the end of the phase.

## Device checklist

These can't be tested from here:

- iPhone: Add to Home Screen, open from the icon, close fully, reopen, airplane mode, export a backup, and Save as PDF from the installed app.
- Android: install prompt, the same reopen and offline checks, export a backup, and Save as PDF.
