# Flower Calculator

A phone-friendly web app that turns flower recipes and wholesale prices into an event estimate: stems to buy, cost, spare stems and a printable work plan. See [docs/PLAN.md](docs/PLAN.md).

## Setup

Requires Node 24 (`nvm use` picks it up from `.nvmrc`).

```sh
npm install
npm run dev
```

## Scripts

| Script                  | Does                                                |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Vite dev server                                     |
| `npm run build`         | Type check and production build                     |
| `npm run typecheck`     | Type check everything                               |
| `npm run lint`          | oxlint and ESLint, zero warnings allowed            |
| `npm run format`        | Prettier write                                      |
| `npm run format:check`  | Prettier check                                      |
| `npm run test`          | Vitest run                                          |
| `npm run test:coverage` | Vitest with coverage (`engine/` needs at least 90%) |
| `npm run check`         | Type check, lint, format check and tests            |
| `npm run api:build`     | Build the Apps Script backend into `api/build`      |
| `npm run api:push`      | Build and push the backend with clasp               |
