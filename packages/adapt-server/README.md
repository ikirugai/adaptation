# @ikirugai/adapt-server

[![npm](https://img.shields.io/npm/v/@ikirugai/adapt-server.svg)](https://www.npmjs.com/package/@ikirugai/adapt-server) [![Live demo](https://img.shields.io/badge/live-adapt.ikirugai.com-0f766e)](https://adapt.ikirugai.com) [![Source](https://img.shields.io/badge/source-github.com%2Fikirugai%2Fadaptation-24292f)](https://github.com/ikirugai/adaptation)

> Server-side primitives for [Adaptation](https://adapt.ikirugai.com). `defineSurface()` to declare what's adaptable in your app, route-handler factories for the 13 Adapt API endpoints, a domain-generic patch applier, and a Postgres-backed session helper.

```bash
npm install @ikirugai/adapt-server @ikirugai/adapt-react
```

See it live at [adapt.ikirugai.com](https://adapt.ikirugai.com) — four demo apps wired up exactly the way described below.

## Quickstart

### 1. Declare your surface

```ts
// src/adaptation.config.ts
import { defineSurface } from "@ikirugai/adapt-server";

export const surface = defineSurface({
  id: "my-app",
  description: "A SaaS dashboard.",
  flags: {
    dark_mode:  { description: "Force dark colour scheme." },
    dense_mode: { description: "Compact spacing throughout." }
  },
  targets: {
    header:  { description: "Top navigation bar." },
    sidebar: { description: "Left sidebar." }
  },
  sections: ["overview", "users", "billing"]
});
```

This declaration is fed to the soft-lane LLM prompt as the source of truth for what your renderer will honour.

### 2. Wire the route handlers

13 routes in total. Each one is two lines:

```ts
// src/app/api/adapt/cards/route.ts
import { createCardsHandlers } from "@ikirugai/adapt-server/handlers";
import { surface } from "@/adaptation.config";
export const { GET, POST } = createCardsHandlers({ surface });
```

Full route list:

| File                                                  | Factory                            |
|-------------------------------------------------------|------------------------------------|
| `api/adapt/cards/route.ts`                            | `createCardsHandlers`              |
| `api/adapt/cards/[id]/route.ts`                       | `createCardByIdHandlers`           |
| `api/adapt/cards/[id]/bake/route.ts`                  | `createCardBakeHandler`            |
| `api/adapt/cards/[id]/redo/route.ts`                  | `createCardRedoHandler`            |
| `api/adapt/patches/route.ts`                          | `createPatchesHandlers`            |
| `api/adapt/library/route.ts`                          | `createLibraryHandler`             |
| `api/adapt/library/[id]/apply/route.ts`               | `createLibraryApplyHandler`        |
| `api/adapt/bake-candidates/route.ts`                  | `createBakeCandidatesListHandler`  |
| `api/adapt/bake-candidates/[id]/bake/route.ts`        | `createBakeCandidateBakeHandler`   |
| `api/adapt/bake-candidates/[id]/dismiss/route.ts`     | `createBakeCandidateDismissHandler`|
| `api/adapt/share/route.ts`                            | `createShareHandler`               |
| `api/adapt/stream/route.ts`                           | `createStreamHandler`              |
| `apply/[token]/route.ts`                              | `createApplyShareHandler`          |

`npx @ikirugai/create-adapt-app` scaffolds all 13 in one go.

### 3. Apply patches in your renderer

```tsx
// src/app/page.tsx
import { getOrCreateSession, loadActivePatches, applyPatches } from "@ikirugai/adapt-server";
import { surface } from "@/adaptation.config";

export default async function Page() {
  const sid = await getOrCreateSession(surface.id);
  const patches = await loadActivePatches(sid);
  const ctx = applyPatches(patches);

  const isDark = ctx.flags.has("dark_mode");
  const isDense = ctx.flags.has("dense_mode");
  // …render based on ctx.flags / ctx.layoutVariants / ctx.itemFilters / etc.
}
```

## Backend services required

This package is the client-side-of-server primitives. The worker, runner, and Slack-approver services that produce patches and execute hard-lane code edits are separate, BSL-1.1-licensed engine apps distributed via Docker images / signed contracts.

Until those ship: use the hosted backend at [adapt.ikirugai.com](https://adapt.ikirugai.com), which already runs the engine for four live demo apps (News, Shop, Journal, Console). Pricing + signup land there when ready.

## Peer dependencies

- `next >= 15`
- `react >= 18`

## License

MIT © Ikirugai
