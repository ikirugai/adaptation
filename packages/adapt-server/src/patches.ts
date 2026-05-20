/**
 * Domain-generic patch loader and applier.
 *
 * Adaptation patches are a JSON document of ops. The applier walks the ops
 * and produces a RenderContext that the consumer's UI maps onto its own
 * components. The applier has no knowledge of the consumer's content shape
 * (articles, products, blog posts, etc.) — content-shaped ops surface as
 * structured data on the context that consumer code consumes.
 */

import type { CSSProperties } from "react";
import { query } from "./db";
import type { Op, Patch, TargetRef } from "./dsl";
import { validatePatch } from "./dsl";

export type PatchRow = { id: string; body: Patch };

export async function loadActivePatches(sessionId: string): Promise<PatchRow[]> {
  const rows = await query<{ id: string; body: any }>(
    "SELECT id, body FROM patches WHERE session_id = $1 AND active = true ORDER BY created_at ASC",
    [sessionId]
  );
  const out: PatchRow[] = [];
  for (const r of rows) {
    const v = validatePatch(r.body);
    if (v.ok) out.push({ id: r.id, body: v.patch });
  }
  return out;
}

export type ItemFilter = {
  exclude_keywords?: string[];
  include_keywords?: string[];
};

export type RenderContext = {
  /** Boolean feature flags requested by the user (any string is valid; consumer interprets). */
  flags: Set<string>;
  /** Targets marked to be hidden via `op.hide`. */
  hiddenTargets: Set<string>;
  /** Inline-style overrides per target key. */
  styles: Record<string, Record<string, string>>;
  /** Text overrides per target key. */
  renames: Record<string, string>;
  /** Layout variant choice per section (e.g. "magazine" | "compact" | "list"). */
  layoutVariants: Record<string, string>;
  /** Banner the consumer should render at the top of the page. */
  banner?: { text: string; tone: "info" | "warn" };
  /** Cross-section ordering of named sections. */
  sectionOrder?: string[];
  /** Item filters scoped by section. Consumer applies these to their item list. */
  itemFilters: Record<string, ItemFilter>;
  /** Pinned-item matchers keyed by section. Consumer floats matching items to the top. */
  pinned: Record<string, string[]>;
};

export function applyPatches(patches: PatchRow[]): RenderContext {
  const ctx: RenderContext = {
    flags: new Set(),
    hiddenTargets: new Set(),
    styles: {},
    renames: {},
    layoutVariants: {},
    itemFilters: {},
    pinned: {}
  };
  for (const p of patches) for (const op of p.body.ops) applyOp(ctx, op);
  return ctx;
}

function applyOp(ctx: RenderContext, op: Op) {
  switch (op.op) {
    case "hide": {
      if (op.target.kind === "article_match") {
        const f = (ctx.itemFilters[op.target.section] ||= {});
        (f.exclude_keywords ||= []).push(op.target.contains);
      } else {
        ctx.hiddenTargets.add(targetKey(op.target));
      }
      break;
    }
    case "rename":
      ctx.renames[targetKey(op.target)] = op.text;
      break;
    case "restyle": {
      const k = targetKey(op.target);
      ctx.styles[k] = { ...(ctx.styles[k] || {}), ...op.css };
      break;
    }
    case "filter_articles": {
      const f = (ctx.itemFilters[op.section] ||= {});
      if (op.exclude_keywords) (f.exclude_keywords ||= []).push(...op.exclude_keywords);
      if (op.include_keywords) (f.include_keywords ||= []).push(...op.include_keywords);
      break;
    }
    case "reorder_sections":
      ctx.sectionOrder = op.order;
      break;
    case "swap_layout":
      ctx.layoutVariants[op.section] = op.variant;
      break;
    case "pin_article":
      (ctx.pinned[op.section] ||= []).push(op.match);
      break;
    case "add_banner":
      ctx.banner = { text: op.text, tone: op.tone || "info" };
      break;
    case "feature_flag":
      if (op.enabled) ctx.flags.add(op.flag); else ctx.flags.delete(op.flag);
      break;
  }
}

export function targetKey(t: TargetRef): string {
  if (t.kind === "feature") return `feature:${t.name}`;
  if (t.kind === "section") return `section:${t.name}`;
  return `article:${t.section}:${t.contains.toLowerCase()}`;
}

export function isTargetHidden(ctx: RenderContext, t: TargetRef): boolean {
  return ctx.hiddenTargets.has(targetKey(t));
}

export function targetStyle(ctx: RenderContext, t: TargetRef): CSSProperties | undefined {
  const css = ctx.styles[targetKey(t)];
  if (!css) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(css)) out[kebabToCamel(k)] = v;
  return out as CSSProperties;
}

export function targetRename(ctx: RenderContext, t: TargetRef, fallback: string): string {
  return ctx.renames[targetKey(t)] ?? fallback;
}

function kebabToCamel(k: string): string {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Apply section-scoped exclude/include filters + pins to a list of items.
 * The consumer provides a `searchableText` accessor so the same helper works
 * for news articles, products, blog posts, etc.
 */
export function applyItemFilter<T>(
  items: T[],
  ctx: RenderContext,
  section: string,
  searchableText: (item: T) => string
): T[] {
  const filter = mergeFilters(ctx.itemFilters[section], ctx.itemFilters["all"]);
  let out = items;
  if (filter) {
    const excl = (filter.exclude_keywords || []).map(k => k.toLowerCase());
    const incl = (filter.include_keywords || []).map(k => k.toLowerCase());
    out = out.filter(it => {
      const hay = searchableText(it).toLowerCase();
      if (excl.length && excl.some(k => hay.includes(k))) return false;
      if (incl.length && !incl.some(k => hay.includes(k))) return false;
      return true;
    });
  }
  const pins = [...(ctx.pinned[section] || []), ...(ctx.pinned["all"] || [])];
  if (pins.length) {
    const matched: T[] = [];
    const rest: T[] = [];
    for (const it of out) {
      const hay = searchableText(it).toLowerCase();
      if (pins.some(p => hay.includes(p.toLowerCase()))) matched.push(it);
      else rest.push(it);
    }
    out = [...matched, ...rest];
  }
  return out;
}

function mergeFilters(a?: ItemFilter, b?: ItemFilter): ItemFilter | undefined {
  if (!a && !b) return undefined;
  return {
    exclude_keywords: [...(a?.exclude_keywords || []), ...(b?.exclude_keywords || [])],
    include_keywords: [...(a?.include_keywords || []), ...(b?.include_keywords || [])]
  };
}
