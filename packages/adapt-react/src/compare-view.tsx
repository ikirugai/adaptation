"use client";

import { useState } from "react";
import { X } from "lucide-react";

const SECTIONS = [
  { key: "uk", label: "UK" },
  { key: "world", label: "World" },
  { key: "sport", label: "Sport" }
];

export function CompareView({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState("uk");
  const [split, setSplit] = useState(50);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink-950">
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2 text-ink-100">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm font-semibold">Compare: original ↔ adapted</span>
          <div className="flex gap-1">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`rounded-full px-2 py-0.5 text-[11px] ${section === s.key ? "bg-ink-100 text-ink-900" : "text-ink-300 hover:bg-ink-800"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-ink-400">
            <span>Split</span>
            <input
              type="range" min={10} max={90} value={split} onChange={e => setSplit(Number(e.target.value))}
              className="h-1 w-32 accent-ink-100"
            />
          </label>
          <button onClick={onClose} className="rounded-md p-1 text-ink-300 hover:bg-ink-800" aria-label="Close compare">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <iframe
          key={`orig-${section}`}
          src={`/${section}?adapted=0`}
          className="absolute inset-y-0 left-0 border-r border-ink-700 bg-ink-50"
          style={{ width: `${split}%` }}
        />
        <iframe
          key={`adap-${section}`}
          src={`/${section}`}
          className="absolute inset-y-0 right-0 bg-ink-50"
          style={{ width: `${100 - split}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 z-10 -ml-px w-0.5 bg-accent/70"
          style={{ left: `${split}%` }}
        />
      </div>
    </div>
  );
}
