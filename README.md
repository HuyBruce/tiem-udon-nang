# Tiệm Udon Nắng

A Vietnamese cozy restaurant simulation built with JavaScript, PixiJS and Vite, prepared by Pham Gia Huy as a public source snapshot on 2026-10-12.

## Play and build locally

```sh
npm ci
npm run dev
```

Use the URL printed by Vite. For an offline-capable production build:

```sh
npm test
npm run build
npm run preview
```

## Features

- Cooking and drink preparation, customer preferences, orders and checkout.
- Ingredient batches, expiration, prices, upgrades, employees, seasons and gardening.
- Local autosave, save validation/migration and JSON export/import.
- Touch/pointer input, audio controls, reduced-motion options and PWA precaching.

## Source map

- `src/systems/`: simulation rules, inventory, economy, time and save management.
- `src/ui/`: scene presentation, interactions and animation.
- `data/`, `config/`, `layouts/`: content and configuration.
- `assets/`, `public/`: runtime visual/audio assets and PWA files.
- `scripts/build-sw.mjs`: production service-worker generation.
- `tests/`: unit and browser checks.

## Verification and current limits

137 unit tests passed on the source snapshot during the portfolio audit. The full browser/offline checks and physical mobile-device tests were not rerun for this publication. Performance under throttled high-DPR conditions is still being improved; this snapshot is a playable prototype, not a completed commercial release. Cloud authentication/sync is not implemented; persistence uses localStorage.

Internal prompts, reference media, local agent configuration, credentials, build output, traces and old development history are excluded. This is a fresh source snapshot; the original working tree remains separate. Font packages retain their upstream licenses. No new blanket license is granted for third-party assets; review provenance before reuse.
