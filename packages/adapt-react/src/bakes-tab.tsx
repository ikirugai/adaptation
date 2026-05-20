"use client";

import { useEffect, useState } from "react";

type Cluster = {
  id: string;
  size: number;
  sample_tasks: string[];
  status: "detected" | "proposed" | "baked" | "dismissed";
  created_at: string;
};

export function BakesTab() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/adapt/bake-candidates").then(r => r.json()).then(d => {
      setClusters(d.clusters || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function bake(id: string) {
    if (acting) return;
    setActing(id);
    try {
      await fetch(`/api/adapt/bake-candidates/${id}/bake`, { method: "POST" });
      setClusters(cs => cs.map(c => c.id === id ? { ...c, status: "proposed" } : c));
    } finally { setActing(null); }
  }
  async function dismiss(id: string) {
    if (acting) return;
    setActing(id);
    try {
      await fetch(`/api/adapt/bake-candidates/${id}/dismiss`, { method: "POST" });
      setClusters(cs => cs.filter(c => c.id !== id));
    } finally { setActing(null); }
  }

  if (!loaded) return <div className="text-sm text-ink-500">Loading bake candidates…</div>;
  if (clusters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500 dark:border-ink-800">
        No bake candidates detected yet. The clusterer runs every 10 minutes and surfaces patterns when ≥3 similar adaptations have happened.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {clusters.map(c => (
        <li key={c.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{c.size} similar adaptations detected</p>
            <span className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">{c.status}</span>
          </div>
          <ul className="mt-2 space-y-0.5 text-[11px] text-ink-700 dark:text-ink-300">
            {c.sample_tasks.slice(0, 5).map((t, i) => <li key={i}>• {t}</li>)}
          </ul>
          {c.status === "detected" && (
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => dismiss(c.id)}
                disabled={acting === c.id}
                className="rounded-md border border-ink-200 px-2.5 py-1 text-[11px] hover:bg-ink-100 dark:border-ink-700 dark:hover:bg-ink-800"
              >
                Skip
              </button>
              <button
                onClick={() => bake(c.id)}
                disabled={acting === c.id}
                className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-amber-700"
              >
                {acting === c.id ? "…" : "Bake for everyone"}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
