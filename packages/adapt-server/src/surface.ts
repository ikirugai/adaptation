/**
 * Surface — the customer's declaration of what's adaptable in their app.
 *
 * The framework is domain-agnostic: news, ecommerce, blog, dashboards all
 * use the same engine but declare different flags, targets, sections,
 * layouts. The Surface drives the Haiku prompt, the validator's defaults,
 * and the library scope.
 */

export type SurfaceFlag = {
  description: string;
};

export type SurfaceTarget = {
  description: string;
};

export type SurfaceBakedFeature = {
  /** The natural-language phrasing a user might write, e.g. "dark mode". */
  task: string;
  /** The feature_flag this maps to. */
  flag: string;
  /** Friendly description for the kanban / library tab. */
  whatItDoes?: string;
};

export type SurfaceSpec = {
  /** Stable identifier — used as the surface_id in DB. */
  id: string;
  /** One-line human description of the app, fed into the Haiku prompt. */
  description?: string;
  /** Boolean feature flags the consumer's renderer honours. */
  flags: Record<string, SurfaceFlag>;
  /** Named regions of the UI that hide/restyle/rename ops can target. */
  targets: Record<string, SurfaceTarget>;
  /** Named "pages" or filter groups (used for section-scoped ops). */
  sections: string[];
  /** Per-section layout variant names. */
  layouts?: Record<string, string[]>;
  /** Pre-declared library entries that resolve instantly without LLM. */
  bakedFeatures?: SurfaceBakedFeature[];
};

export type Surface = SurfaceSpec & {
  /** Composed Haiku system prompt — auto-generated from the spec. */
  prompt: string;
};

/**
 * Returns a fully-resolved Surface with prompt baked in.
 * Consumers store the resulting object once at boot and reuse it.
 */
export function defineSurface(spec: SurfaceSpec): Surface {
  return { ...spec, prompt: generateDSLPrompt(spec) };
}

/* ---------- Prompt assembly ---------- */

export function generateDSLPrompt(s: SurfaceSpec): string {
  const flagLines = Object.entries(s.flags).length
    ? Object.entries(s.flags).map(([f, d]) => `     - "${f}": ${d.description}`).join("\n")
    : "     (no flags declared)";

  const targetLines = Object.entries(s.targets).length
    ? Object.entries(s.targets).map(([t, d]) => `       - "${t}": ${d.description}`).join("\n")
    : "       (no named targets declared)";

  const sectionsLiteral = s.sections.map(x => `"${x}"`).join(" | ") + ' | "all"';
  const sectionsTuple = s.sections.map(x => `"${x}"`).join(" | ");

  const layoutLines = s.layouts && Object.keys(s.layouts).length
    ? Object.entries(s.layouts).map(([section, variants]) =>
        `   - section "${section}": ${variants.map(v => `"${v}"`).join(" | ")}`).join("\n")
    : "   (no layout variants declared — swap_layout op should not be used)";

  const bakedLines = s.bakedFeatures?.length
    ? s.bakedFeatures.map(b => `   - "${b.task}" → feature_flag "${b.flag}" (${b.whatItDoes ?? ""})`).join("\n")
    : "";

  const appLine = s.description
    ? `Application: ${s.id} — ${s.description}`
    : `Application: ${s.id}`;

  return `
You translate a user's natural-language adaptation request into a Patch.
${appLine}

Output a single JSON object matching the Patch type. No prose, no markdown fences.
Type Patch = { ops: Op[] }.

Op variants:

1. { "op": "hide", "target": TargetRef }
2. { "op": "rename", "target": TargetRef, "text": string }
3. { "op": "restyle", "target": TargetRef, "css": { [prop]: value } }
   allowed props: color, background-color, font-size, font-weight, font-family,
   padding, padding-top|bottom|left|right, margin, margin-top|bottom|left|right,
   border-radius, border, border-color, text-align, line-height, letter-spacing.
   Values ≤60 chars; no url() / expression() / ; / { } / < > / backslash.
4. { "op": "filter_articles", "section": ${sectionsLiteral}, "exclude_keywords"?: string[], "include_keywords"?: string[] }
5. { "op": "reorder_sections", "order": (${sectionsTuple})[] }
6. { "op": "swap_layout", "section": ${sectionsLiteral}, "variant": <one of the per-section variants below> }
${layoutLines}
7. { "op": "pin_article", "section": ${sectionsLiteral}, "match": string }
8. { "op": "add_banner", "text": string, "tone"?: "info"|"warn" }
9. { "op": "feature_flag", "flag": string, "enabled": boolean }
   Known flags for this app:
${flagLines}

TargetRef variants:
- { "kind": "feature", "name": <target-name> } where target-name is one of:
${targetLines}
- { "kind": "section", "name": ${sectionsLiteral} }
- { "kind": "article_match", "section": ${sectionsLiteral}, "contains": string }

${bakedLines ? `Hint: these natural-language phrasings map directly to feature_flag ops:\n${bakedLines}\n\n` : ""}Rules:
- Generate ops for EVERY part of the request that any op above can achieve.
- Prefer feature_flag over restyle/hide combinations where a declared flag fits.
- Only return { "ops": [], "unsupported": "<one-sentence reason>" } if literally NOTHING in the request can be expressed in this DSL.
- Bias toward action: a partial fulfilment is better than nothing.
- Output JSON only.
`.trim();
}
