"use client";

export type PromptChip = { label: string; prompt: string };

// Generic across surfaces — these adaptations work whether you're on
// a news site, a shop, a blog or a dashboard. Consumers can override
// by passing the `chips` prop with surface-appropriate suggestions
// derived from their defineSurface() declaration.
const DEFAULT_CHIPS: PromptChip[] = [
  { label: "Dark mode",      prompt: "Use a dark colour scheme." },
  { label: "Larger text",    prompt: "Make text noticeably larger." },
  { label: "Hide images",    prompt: "Hide every image on the page." },
  { label: "Compact layout", prompt: "Switch to a compact, denser layout." }
];

export function PromptChips({
  onPick,
  chips = DEFAULT_CHIPS
}: {
  onPick: (text: string) => void;
  chips?: PromptChip[];
}) {
  return (
    <div className="-mx-1 flex flex-wrap gap-1.5 pb-3">
      {chips.map(c => (
        <button
          key={c.label}
          onClick={() => onPick(c.prompt)}
          className="rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-[11px] text-ink-700 transition hover:bg-ink-100 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
