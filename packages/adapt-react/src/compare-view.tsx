"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * A single "page" the user can flip between when comparing original vs
 * adapted. For news this is `{ key: "uk", label: "UK", path: "/uk" }`.
 * For shop it might be `{ key: "tech", label: "Tech", path: "/?c=tech" }`.
 * For dashboard `{ key: "users", label: "Users", path: "/users" }`.
 *
 * If `path` is omitted, the key is used as the URL path (legacy news
 * behaviour). The "?adapted=0" param is added by the iframe URL builder
 * to tell the host page to render without applying patches.
 */
export type ComparePage = {
  key: string;
  label: string;
  path?: string;
};

const DEFAULT_PAGES: ComparePage[] = [
  { key: "uk",    label: "UK",    path: "/uk" },
  { key: "world", label: "World", path: "/world" },
  { key: "sport", label: "Sport", path: "/sport" }
];

function pageUrl(p: ComparePage, withAdapted: boolean): string {
  const base = p.path ?? `/${p.key}`;
  // Preserve any existing query string and append/override adapted=...
  const sep = base.includes("?") ? "&" : "?";
  return withAdapted ? base : `${base}${sep}adapted=0`;
}

export function CompareView({
  onClose,
  pages = DEFAULT_PAGES
}: {
  onClose: () => void;
  /**
   * The pages the user can flip between. Defaults to the three news
   * sections so existing consumers keep working without changes.
   * Pass your surface's own pages (e.g. derived from defineSurface
   * sections + a section-to-path map) to make Compare useful on
   * non-news apps.
   */
  pages?: ComparePage[];
}) {
  const [active, setActive] = useState(pages[0]?.key ?? "");
  const [split, setSplit] = useState(50);
  const current = pages.find(p => p.key === active) ?? pages[0];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink-950">
      <div className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-4 py-2 text-ink-100">
        <div className="flex items-center gap-3">
          <span className="font-serif text-sm font-semibold">Compare: original ↔ adapted</span>
          {pages.length > 1 && (
            <div className="flex gap-1">
              {pages.map(p => (
                <button
                  key={p.key}
                  onClick={() => setActive(p.key)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${active === p.key ? "bg-ink-100 text-ink-900" : "text-ink-300 hover:bg-ink-800"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
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
        {current && (
          <>
            <iframe
              key={`orig-${current.key}`}
              src={pageUrl(current, false)}
              className="absolute left-0 top-0 border-r border-ink-700 bg-ink-50"
              // Explicit height: iframes ignore CSS `inset-y-0` in some
              // browsers and fall back to their intrinsic 150px default.
              style={{ width: `${split}%`, height: "100%" }}
            />
            <iframe
              key={`adap-${current.key}`}
              src={pageUrl(current, true)}
              className="absolute right-0 top-0 bg-ink-50"
              style={{ width: `${100 - split}%`, height: "100%" }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 z-10 -ml-px w-0.5 bg-accent/70"
              style={{ left: `${split}%` }}
            />
          </>
        )}
      </div>
    </div>
  );
}
