"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AdaptDrawer } from "./adapt-drawer";
import { SnipOverlay, type SnipResult } from "./snip-overlay";
import { cn } from "./cn";

export function AdaptLauncher({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [snipping, setSnipping] = useState(false);
  const [snip, setSnip] = useState<SnipResult | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/adapt/stream");
    const update = () => {
      fetch("/api/adapt/cards").then(r => r.json()).then(d => {
        const n = (d.cards || []).filter((c: any) => isWorking(c.status)).length;
        setActive(n);
      }).catch(() => {});
    };
    update();
    es.addEventListener("card.update", update);
    es.addEventListener("card.new", update);

    // Listen for the live-status pill click in the header.
    const onOpen = () => setOpen(true);
    window.addEventListener("adapt:open", onOpen);

    return () => {
      es.close();
      window.removeEventListener("adapt:open", onOpen);
    };
  }, []);

  function requestSnip() {
    setOpen(false);
    setSnipping(true);
  }
  function onSnipped(r: SnipResult) {
    setSnip(r);
    setSnipping(false);
    setOpen(true);
  }
  function cancelSnip() {
    setSnipping(false);
    setOpen(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full px-5 py-3 shadow-lg transition",
          "bg-ink-900 text-ink-50 hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-ink-200",
          snipping && "hidden",
          active > 0 && "swirl-border"
        )}
        aria-label={open ? "Close Adapt" : "Adapt this page"}
      >
        <Sparkles size={18} />
        <span className="font-medium">Adapt</span>
        {active > 0 && (
          <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">{active}</span>
        )}
      </button>
      <AdaptDrawer
        open={open}
        onClose={() => setOpen(false)}
        sessionId={sessionId}
        snip={snip}
        onRequestSnip={requestSnip}
        onClearSnip={() => setSnip(null)}
      />
      {snipping && <SnipOverlay onSnip={onSnipped} onCancel={cancelSnip} />}
    </>
  );
}

function isWorking(status: string): boolean {
  return ["queued","analyzing","generating","validating","applying","awaiting_approval","running"].includes(status);
}
