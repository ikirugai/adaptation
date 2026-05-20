"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "./cn";

const WORKING = ["queued","analyzing","generating","validating","applying","awaiting_approval","running"];

export function LiveStatus() {
  const [working, setWorking] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      try {
        const r = await fetch("/api/adapt/cards");
        if (!r.ok) return;
        const { cards = [] } = await r.json();
        if (cancelled) return;
        setWorking(cards.filter((c: any) => WORKING.includes(c.status)).length);
        setActive(cards.filter((c: any) => c.status === "applied" || c.status === "done").length);
      } catch {}
    };
    update();
    const es = new EventSource("/api/adapt/stream");
    es.addEventListener("card.new", update);
    es.addEventListener("card.update", update);
    return () => { cancelled = true; es.close(); };
  }, []);

  if (working === 0 && active === 0) return null;

  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("adapt:open"))}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
        working > 0
          ? "swirl-border bg-ink-50 text-ink-900 dark:bg-ink-900 dark:text-ink-100"
          : "bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
      )}
      title={working > 0 ? "Adaptations cooking" : "Active adaptations"}
    >
      <Sparkles size={11} />
      {working > 0
        ? <span>{working} cooking</span>
        : <span>{active} active</span>}
    </button>
  );
}
