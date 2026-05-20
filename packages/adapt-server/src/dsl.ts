/**
 * The Patch DSL.
 * Soft-lane adaptations are expressed exclusively in this shape.
 * If a user request cannot be expressed here, it routes to the hard lane.
 *
 * This file is the single source of truth for the DSL. The worker reads it
 * and embeds the JSON schema string in the Haiku prompt (cached).
 */

export type SectionRef = "uk" | "world" | "sport" | "all";

export type Op =
  | { op: "hide"; target: TargetRef }
  | { op: "rename"; target: TargetRef; text: string }
  | { op: "restyle"; target: TargetRef; css: Record<string, string> }
  | { op: "filter_articles"; section: SectionRef; exclude_keywords?: string[]; include_keywords?: string[] }
  | { op: "reorder_sections"; order: ("uk" | "world" | "sport")[] }
  | { op: "swap_layout"; section: SectionRef; variant: "magazine" | "compact" | "list" }
  | { op: "pin_article"; section: SectionRef; match: string }
  | { op: "add_banner"; text: string; tone?: "info" | "warn" }
  | { op: "feature_flag"; flag: string; enabled: boolean };

export type TargetRef =
  | { kind: "feature"; name: KnownFeatureTarget }
  | { kind: "section"; name: SectionRef }
  | { kind: "article_match"; section: SectionRef; contains: string };

export type KnownFeatureTarget =
  | "header"
  | "section_tabs"
  | "footer"
  | "article_thumbnails"
  | "article_summaries"
  | "article_timestamps"
  | "adapt_button";

export type Patch = {
  ops: Op[];
};

/* ---------- Validation ---------- */

export function validatePatch(value: unknown): { ok: true; patch: Patch } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "patch must be an object" };
  const v = value as any;
  if (!Array.isArray(v.ops)) return { ok: false, error: "patch.ops must be an array" };
  for (let i = 0; i < v.ops.length; i++) {
    const r = validateOp(v.ops[i]);
    if (!r.ok) return { ok: false, error: `ops[${i}]: ${r.error}` };
  }
  return { ok: true, patch: v as Patch };
}

function validateOp(op: any): { ok: true } | { ok: false; error: string } {
  if (!op || typeof op !== "object") return { ok: false, error: "op must be an object" };
  switch (op.op) {
    case "hide":
      if (!validTarget(op.target)) return { ok: false, error: "invalid target" };
      return { ok: true };
    case "rename":
      if (!validTarget(op.target)) return { ok: false, error: "invalid target" };
      if (typeof op.text !== "string" || op.text.length > 200) return { ok: false, error: "text must be string ≤200" };
      return { ok: true };
    case "restyle":
      if (!validTarget(op.target)) return { ok: false, error: "invalid target" };
      if (!op.css || typeof op.css !== "object") return { ok: false, error: "css must be object" };
      for (const [k, val] of Object.entries(op.css)) {
        if (!ALLOWED_CSS_PROPS.has(k)) return { ok: false, error: `css prop ${k} not allowed` };
        if (typeof val !== "string" || val.length > 60) return { ok: false, error: `css ${k} value invalid` };
        if (/[;{}<>\\]/.test(val) || /url\s*\(/i.test(val) || /expression\s*\(/i.test(val)) {
          return { ok: false, error: `css ${k} value contains forbidden chars` };
        }
      }
      return { ok: true };
    case "filter_articles":
      if (!validSection(op.section)) return { ok: false, error: "invalid section" };
      if (op.exclude_keywords && !Array.isArray(op.exclude_keywords)) return { ok: false, error: "exclude_keywords must be array" };
      if (op.include_keywords && !Array.isArray(op.include_keywords)) return { ok: false, error: "include_keywords must be array" };
      return { ok: true };
    case "reorder_sections":
      if (!Array.isArray(op.order)) return { ok: false, error: "order must be array" };
      for (const s of op.order) if (!["uk","world","sport"].includes(s)) return { ok: false, error: `bad section ${s}` };
      return { ok: true };
    case "swap_layout":
      if (!validSection(op.section)) return { ok: false, error: "invalid section" };
      if (!["magazine","compact","list"].includes(op.variant)) return { ok: false, error: "invalid variant" };
      return { ok: true };
    case "pin_article":
      if (!validSection(op.section)) return { ok: false, error: "invalid section" };
      if (typeof op.match !== "string") return { ok: false, error: "match must be string" };
      return { ok: true };
    case "add_banner":
      if (typeof op.text !== "string" || op.text.length > 240) return { ok: false, error: "text must be string ≤240" };
      return { ok: true };
    case "feature_flag":
      if (typeof op.flag !== "string") return { ok: false, error: "flag must be string" };
      if (typeof op.enabled !== "boolean") return { ok: false, error: "enabled must be boolean" };
      return { ok: true };
    default:
      return { ok: false, error: `unknown op ${op.op}` };
  }
}

function validTarget(t: any): boolean {
  if (!t || typeof t !== "object") return false;
  // Feature target names are surface-declared; we don't gate at runtime — the
  // surface's Haiku prompt tells the model what's available, and unknown targets
  // simply no-op in the applier.
  if (t.kind === "feature") return typeof t.name === "string" && t.name.length > 0 && t.name.length < 80;
  if (t.kind === "section") return validSection(t.name);
  if (t.kind === "article_match") return validSection(t.section) && typeof t.contains === "string";
  return false;
}
// Section names are also surface-declared. We accept any short string + "all".
function validSection(s: any): boolean { return typeof s === "string" && s.length > 0 && s.length < 80; }

const ALLOWED_CSS_PROPS = new Set<string>([
  "color","background-color","font-size","font-weight","font-family",
  "padding","padding-top","padding-bottom","padding-left","padding-right",
  "margin","margin-top","margin-bottom","margin-left","margin-right",
  "border-radius","border","border-color","text-align","line-height","letter-spacing"
]);

// The DSL classifier prompt that teaches the model how to emit patches lives in
// the engine (apps/worker), not here. Consumers of this SDK receive validated
// patches from the engine — they don't need (and shouldn't see) the prompt.
