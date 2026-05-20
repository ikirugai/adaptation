"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Undo2, Redo2, X, Sparkles, Share2 } from "lucide-react";
import { cn } from "./cn";

export type CardRow = {
  id: string;
  task_text: string;
  status:
    | "queued" | "analyzing" | "generating" | "validating" | "applying"
    | "awaiting_approval" | "running"
    | "applied" | "deployed" | "done"
    | "rejected" | "failed"
    | "undone" | "cancelled";
  lane: "soft" | "hard" | null;
  kind: "adapt" | "bake" | "revert" | null;
  library_tier: "baked-default" | "baked-feature" | "soft-patch-reusable" | null;
  library_hits: any;
  patch_id: string | null;
  pr_url: string | null;
  commit_sha: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: string | number | null;
  parent_card_id: string | null;
  error: string | null;
  created_at: string;
  last_event?: { kind: string; payload: any };
  events_tail?: { kind: string; payload: any; created_at: string }[];
};

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  analyzing: "Analysing",
  generating: "Generating",
  validating: "Validating",
  applying: "Applying",
  awaiting_approval: "Awaiting approval",
  running: "Claude Code working",
  applied: "Applied",
  deployed: "Deployed",
  done: "Done",
  rejected: "Rejected",
  failed: "Failed",
  undone: "Undone",
  cancelled: "Cancelled"
};

const WORKING = new Set([
  "queued","analyzing","generating","validating","applying","awaiting_approval","running"
]);
const UNDOABLE = new Set(["applied","done"]);
const CANCELLABLE = new Set(["queued","analyzing","generating","validating","applying","awaiting_approval"]);

export function KanbanCard({ card }: { card: CardRow }) {
  const [pending, setPending] = useState(false);
  const working = WORKING.has(card.status);
  const tone =
    card.status === "failed" || card.status === "rejected"
      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40"
      : card.status === "undone" || card.status === "cancelled"
      ? "border-ink-200 bg-ink-50 opacity-70 dark:border-ink-800 dark:bg-ink-900"
      : card.status === "done" || card.status === "applied" || card.status === "deployed"
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
      : "border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900";

  async function undo() {
    if (pending) return;
    setPending(true);
    try { await fetch(`/api/adapt/cards/${card.id}`, { method: "DELETE" }); }
    finally { setPending(false); }
  }
  async function redo() {
    if (pending) return;
    setPending(true);
    try {
      const r = await fetch(`/api/adapt/cards/${card.id}/redo`, { method: "POST" });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({}));
        if (error) alert(error);
      }
    } finally { setPending(false); }
  }
  async function bake() {
    if (pending) return;
    setPending(true);
    try { await fetch(`/api/adapt/cards/${card.id}/bake`, { method: "POST" }); }
    finally { setPending(false); }
  }
  async function share() {
    if (pending) return;
    setPending(true);
    try {
      const r = await fetch(`/api/adapt/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ card_id: card.id })
      });
      if (r.ok) {
        const { url } = await r.json();
        try {
          await navigator.clipboard.writeText(url);
        } catch {}
        alert(`Share link copied to clipboard:\n${url}`);
      }
    } finally { setPending(false); }
  }

  const canUndo = (UNDOABLE.has(card.status) && card.lane === "soft") ||
                  (card.status === "deployed" && card.lane === "hard" && card.kind !== "revert" && !!card.commit_sha);
  const canCancel = CANCELLABLE.has(card.status);
  const canBake = card.lane === "soft" && UNDOABLE.has(card.status) && card.kind === "adapt";
  const canShare = UNDOABLE.has(card.status) && card.lane === "soft";
  const canRedo = card.lane === "soft" && card.status === "undone";
  const deployedNote = card.status === "deployed" && card.lane === "hard" && !card.commit_sha;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border p-3 text-sm shadow-sm",
        tone,
        working && "swirl-border"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn(
          "font-medium leading-snug",
          (card.status === "undone" || card.status === "cancelled") && "line-through text-ink-500"
        )}>{card.task_text}</p>
        <Badge status={card.status} />
      </div>

      {card.library_tier && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          Library: {card.library_tier}
        </div>
      )}

      <Pipeline status={card.status} />

      {displayText(card) && (
        <p className="mt-2 truncate font-mono text-[11px] text-ink-500">{displayText(card)}</p>
      )}

      {card.pr_url && (
        <a href={card.pr_url} target="_blank" rel="noopener noreferrer"
           className="mt-2 inline-block text-xs text-sky-600 hover:underline dark:text-sky-400">
          View PR →
        </a>
      )}
      {card.error && <p className="mt-2 text-xs text-red-700 dark:text-red-300">{card.error}</p>}

      <CostFooter card={card} />

      {(canUndo || canCancel || canBake || canShare || canRedo || deployedNote) && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          {deployedNote && (
            <span className="text-[11px] text-ink-400">Baked, no commit_sha tracked — undo via git revert</span>
          )}
          {canRedo && (
            <button
              onClick={redo}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              title="Re-apply this adaptation"
            >
              <Redo2 size={11} /> Redo
            </button>
          )}
          {canShare && (
            <button
              onClick={share}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              title="Get a shareable URL of this adaptation"
            >
              <Share2 size={11} /> Share
            </button>
          )}
          {canBake && (
            <button
              onClick={bake}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60"
              title="Bake this adaptation for everyone (Slack approval)"
            >
              <Sparkles size={11} /> Bake for all
            </button>
          )}
          {canUndo && (
            <button
              onClick={undo}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              title="Undo this adaptation"
            >
              <Undo2 size={11} /> Undo
            </button>
          )}
          {canCancel && (
            <button
              onClick={undo}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] text-ink-600 hover:bg-ink-100 disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              title="Cancel"
            >
              <X size={11} /> Cancel
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function CostFooter({ card }: { card: CardRow }) {
  const cost = card.cost_usd == null ? null : Number(card.cost_usd);
  const t_in = card.tokens_in;
  const t_out = card.tokens_out;
  const libHit = card.library_tier && card.library_tier !== "soft-patch-reusable";
  if (!cost && !t_in && !t_out && !libHit) return null;
  return (
    <p className="mt-2 text-[10px] text-ink-400">
      {libHit && <span className="mr-2 text-emerald-700 dark:text-emerald-300">$0 — library hit</span>}
      {!libHit && cost != null && <span className="mr-2">{formatUsd(cost)}</span>}
      {(t_in != null || t_out != null) && (
        <span className="font-mono">{t_in ?? 0} in / {t_out ?? 0} out tok</span>
      )}
    </p>
  );
}

function formatUsd(n: number): string {
  if (n < 0.001) return "<$0.001";
  if (n < 0.01)  return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function Badge({ status }: { status: CardRow["status"] }) {
  const muted = status === "undone" || status === "cancelled";
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
      muted
        ? "bg-ink-300 text-ink-700 dark:bg-ink-700 dark:text-ink-300"
        : "bg-ink-900 text-ink-50 dark:bg-ink-100 dark:text-ink-900"
    )}>
      {STAGE_LABELS[status] || status}
    </span>
  );
}

function displayText(card: CardRow): string | null {
  const events = card.events_tail || [];
  for (const e of events) {
    if (e.payload?.kind === "page.refresh") continue;
    if (typeof e.payload?.text === "string" && e.payload.text.trim()) return e.payload.text;
  }
  return null;
}

const PIPELINE: CardRow["status"][] = ["analyzing","generating","validating","applying"];
function Pipeline({ status }: { status: CardRow["status"] }) {
  const idx = PIPELINE.indexOf(status);
  if (idx < 0 && !WORKING.has(status)) return null;
  return (
    <div className="mt-2 flex gap-1">
      {PIPELINE.map((s, i) => (
        <div key={s} className={cn(
          "h-1 flex-1 rounded-full",
          i < idx ? "bg-ink-400" : i === idx ? "bg-accent animate-pulse-glow" : "bg-ink-200 dark:bg-ink-800"
        )} />
      ))}
    </div>
  );
}
