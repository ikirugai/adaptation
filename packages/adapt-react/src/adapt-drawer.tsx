"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Scissors, X, Send, GitCompareArrows } from "lucide-react";
import { KanbanCard, type CardRow } from "./kanban-card";
import { LibraryTab } from "./library-tab";
import { BakesTab } from "./bakes-tab";
import { CompareView } from "./compare-view";
import { PromptChips } from "./prompt-chips";
import { VoiceButton } from "./voice-button";
import type { SnipResult } from "./snip-overlay";
import { cn } from "./cn";

const COLUMNS: { key: CardRow["status"][]; label: string }[] = [
  { key: ["queued","analyzing","generating","validating","applying"], label: "In flight" },
  { key: ["awaiting_approval"], label: "Awaiting approval" },
  { key: ["running"], label: "Claude Code working" },
  { key: ["applied","deployed","done"], label: "Done" },
  { key: ["undone","cancelled"], label: "Undone" },
  { key: ["rejected","failed"], label: "Closed" }
];

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  snip: SnipResult | null;
  onRequestSnip: () => void;
  onClearSnip: () => void;
  /** Forwarded to CompareView so non-news surfaces can supply their own
   *  page list. If omitted, CompareView falls back to news sections. */
  comparePages?: import("./compare-view").ComparePage[];
};

type Tab = "cards" | "library" | "bakes";

export function AdaptDrawer({ open, onClose, snip, onRequestSnip, onClearSnip, comparePages }: Props) {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<Tab>("cards");
  const [comparing, setComparing] = useState(false);
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = () => {
    fetch("/api/adapt/cards").then(r => r.json()).then(d => setCards(d.cards || [])).catch(() => {});
  };

  useEffect(() => {
    refetch();
    const es = new EventSource("/api/adapt/stream");
    es.addEventListener("card.new", refetch);
    es.addEventListener("card.update", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        if (data.payload?.kind === "page.refresh") {
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 350);
        }
      } catch {}
      refetch();
    });
    return () => es.close();
  }, [router]);

  async function resetAll() {
    if (!confirm("Reset every adaptation in this session?")) return;
    await fetch("/api/adapt/patches", { method: "DELETE" });
    refetch();
  }

  async function submit() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch("/api/adapt/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          task_text: text.trim(),
          snip_selector: snip?.selector,
          snip_bbox: snip?.bbox,
          snip_image: snip?.dataUrl
        })
      });
      setText("");
      onClearSnip();
      refetch();
      setTab("cards");
    } finally { setSending(false); }
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {open && (
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className={cn(
              "fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-ink-950",
              "sm:rounded-l-2xl"
            )}
          >
            <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4 dark:border-ink-800">
              <div>
                <h2 className="font-serif text-xl font-semibold">Adapt</h2>
                <p className="text-xs text-ink-500">Reshape this page just for you.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setComparing(true)}
                  className="rounded-md p-2 hover:bg-ink-100 dark:hover:bg-ink-900"
                  aria-label="Compare original vs adapted"
                  title="Compare original ↔ adapted"
                >
                  <GitCompareArrows size={18} />
                </button>
                <button onClick={onClose} className="rounded-md p-2 hover:bg-ink-100 dark:hover:bg-ink-900" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="border-b border-ink-200 px-5 py-4 dark:border-ink-800">
              {!text.trim() && !snip && <PromptChips onPick={t => setText(t)} />}
              {snip && (
                <div className="mb-3 flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50 p-2 dark:border-ink-800 dark:bg-ink-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={snip.dataUrl} alt="" className="h-12 w-12 rounded object-cover" />
                  <div className="flex-1 truncate text-xs text-ink-500">
                    <div className="font-mono truncate">{snip.selector}</div>
                    <div>Snipped region attached</div>
                  </div>
                  <button className="text-xs text-ink-400 hover:text-ink-600" onClick={onClearSnip}>remove</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                  placeholder="What should change?"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm outline-none focus:border-ink-400 dark:border-ink-800 dark:bg-ink-900"
                />
                <VoiceButton onTranscript={(t) => setText(prev => prev ? prev + " " + t : t)} />
                <button
                  onClick={onRequestSnip}
                  className="rounded-lg border border-ink-200 p-2 hover:bg-ink-100 dark:border-ink-800 dark:hover:bg-ink-900"
                  title="Snip a region of the page"
                >
                  <Scissors size={18} />
                </button>
                <button
                  onClick={submit}
                  disabled={sending || !text.trim()}
                  className="flex items-center gap-1 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-ink-50 disabled:opacity-50 dark:bg-ink-100 dark:text-ink-900"
                >
                  <Send size={14} /> Send
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-ink-400">⌘/Ctrl + Enter to send</p>
                <button
                  onClick={resetAll}
                  className="text-[11px] text-ink-400 underline hover:text-ink-600 dark:hover:text-ink-300"
                >
                  Reset all adaptations
                </button>
              </div>
            </div>

            <div className="flex border-b border-ink-200 px-3 dark:border-ink-800">
              {([
                { id: "cards"   as Tab, label: `Activity${cards.length ? ` (${cards.length})` : ""}` },
                { id: "library" as Tab, label: "Library" },
                { id: "bakes"   as Tab, label: "Bakes" }
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-xs font-medium transition",
                    tab === t.id
                      ? "border-ink-900 text-ink-900 dark:border-ink-100 dark:text-ink-100"
                      : "border-transparent text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === "cards" && (
                <div className="grid grid-cols-1 gap-4">
                  {COLUMNS.map(col => {
                    const cs = cards.filter(c => col.key.includes(c.status));
                    if (cs.length === 0) return null;
                    return (
                      <div key={col.label}>
                        <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">{col.label}</div>
                        <div className="flex flex-col gap-2">
                          {cs.map(c => <KanbanCard key={c.id} card={c} />)}
                        </div>
                      </div>
                    );
                  })}
                  {cards.length === 0 && (
                    <div className="rounded-lg border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500 dark:border-ink-800">
                      No adaptations yet. Tap a chip above, type a task, or snip a region.
                    </div>
                  )}
                </div>
              )}
              {tab === "library" && <LibraryTab />}
              {tab === "bakes" && <BakesTab />}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {comparing && <CompareView onClose={() => setComparing(false)} pages={comparePages} />}
    </>
  );
}
