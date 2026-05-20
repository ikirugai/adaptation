"use client";

const CHIPS: { label: string; prompt: string }[] = [
  { label: "Compact layout",    prompt: "Switch to compact layout — small thumbnail to the left of each headline." },
  { label: "Dark mode",         prompt: "Use a dark colour scheme." },
  { label: "Larger text",       prompt: "Make headlines and summaries larger." },
  { label: "Hide football",     prompt: "Hide all stories that mention football." },
  { label: "Date next to title",prompt: "Show the full publish date inline next to each headline." },
  { label: "No images",         prompt: "Hide every article thumbnail." }
];

export function PromptChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="-mx-1 flex flex-wrap gap-1.5 pb-3">
      {CHIPS.map(c => (
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
