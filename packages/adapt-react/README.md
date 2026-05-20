# @ikirugai/adapt-react

> Drop-in React components for [Adaptation](https://github.com/ikirugai/adaptivesoftware) — a floating "Adapt" button that lets users reshape your app in natural language. Popular changes graduate into defaults for everyone.

```bash
npm install @ikirugai/adapt-react @ikirugai/adapt-server
```

## What you get

| Export            | What it is                                                                |
|-------------------|---------------------------------------------------------------------------|
| `AdaptLauncher`   | The floating Adapt FAB + drawer. Drop into your root layout.              |
| `AdaptDrawer`     | The side drawer (kanban + library + bake tabs) — already inside Launcher. |
| `KanbanCard`      | Single-card primitive used inside the drawer.                             |
| `LiveStatus`      | Header pill that shows "N cooking" or "N active" via SSE.                 |
| `PromptChips`     | Pre-canned prompt suggestions above the textarea.                         |
| `VoiceButton`     | Browser `SpeechRecognition` mic; hides on unsupported browsers.           |
| `SnipOverlay`     | Drag-to-snip a page region; uses `html2canvas-pro`.                       |
| `LibraryTab`      | The Library tab (apply baked features / saved patches in one click).      |
| `BakesTab`        | The Bakes tab (surfaces clustered patterns up for promotion).             |
| `CompareView`     | Split-screen original ↔ adapted iframes with a draggable slider.          |

## Quickstart

```tsx
// app/layout.tsx
import { AdaptLauncher } from "@ikirugai/adapt-react";
import { getOrCreateSession } from "@ikirugai/adapt-server";
import { surface } from "@/adaptation.config";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const sessionId = await getOrCreateSession(surface.id);
  return (
    <html lang="en">
      <body>
        {children}
        <AdaptLauncher sessionId={sessionId} />
      </body>
    </html>
  );
}
```

You'll also need to declare an adaptation surface (flags, targets, sections) and wire 13 API routes — see [`@ikirugai/adapt-server`](https://www.npmjs.com/package/@ikirugai/adapt-server) for those, or use `npx @ikirugai/create-adapt-app` to scaffold the lot in one command.

## Tailwind

The components ship as Tailwind class names. Add this to your `tailwind.config.ts`:

```ts
content: [
  "./src/**/*.{ts,tsx}",
  "./node_modules/@ikirugai/adapt-react/dist/**/*.{js,mjs}"
]
```

## Peer dependencies

- `react >= 18`
- `react-dom >= 18`
- `next >= 15`

## License

MIT © Ikirugai
