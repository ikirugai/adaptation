import { NextResponse } from "next/server";
import type { Surface } from "../surface";
import { getOrCreateSession } from "../session";
import { one, query } from "../db";

const SLACK_APPROVER_URL = process.env.SLACK_APPROVER_URL || "http://slack-approver:8090";

export function createBakeCandidatesListHandler(_opts: { surface: Surface }) {
  // Bake clusters are surface-agnostic for now (clusterer doesn't yet partition them);
  // we still expose them so the UI can show what's trending across the platform.
  async function GET() {
    const rows = await query<{
      id: string; size: number; sample_tasks: string[]; status: string; created_at: string;
    }>(`SELECT id, size, sample_tasks, status, created_at
        FROM bake_clusters
        WHERE status IN ('detected','proposed')
        ORDER BY created_at DESC
        LIMIT 50`);
    return NextResponse.json({ clusters: rows });
  }
  return { GET };
}

export function createBakeCandidateBakeHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const sid = await getOrCreateSession(surface.id);

    const cluster = await one<{ id: string; size: number; sample_tasks: string[]; status: string }>(
      "SELECT id, size, sample_tasks, status FROM bake_clusters WHERE id = $1", [id]
    );
    if (!cluster) return NextResponse.json({ error: "cluster not found" }, { status: 404 });
    if (cluster.status !== "detected") return NextResponse.json({ error: "cluster already actioned" }, { status: 400 });

    const representative = cluster.sample_tasks[0] || "(unknown)";
    const prompt =
      `Bake the following adaptation pattern into the codebase as the default for everyone on the "${surface.id}" app.\n\n` +
      `${cluster.size} users have requested versions of this:\n` +
      cluster.sample_tasks.slice(0, 6).map(t => `- "${t}"`).join("\n") +
      `\n\nImplement the most representative version of this as the default in the "${surface.id}" surface code.`;

    const card = await one<{ id: string }>(
      `INSERT INTO cards (session_id, task_text, status, lane, kind, surface_id, surface)
       VALUES ($1, $2, 'awaiting_approval', 'hard', 'bake', $3, $4) RETURNING id`,
      [sid, `Cluster bake: ${representative.slice(0, 100)}`, surface.id, JSON.stringify(surface)]
    );
    const cardId = card!.id;
    await query("INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.queued', $2)",
      [cardId, JSON.stringify({ text: `Cluster bake — ${cluster.size} similar requests.` })]);

    const approval = await one<{ id: string }>(
      `INSERT INTO approvals (card_id, proposed_prompt, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [cardId, prompt]
    );
    await query("UPDATE cards SET approval_id = $1 WHERE id = $2", [approval!.id, cardId]);
    await query("UPDATE bake_clusters SET status = 'proposed', card_id = $1 WHERE id = $2", [cardId, id]);

    fetch(`${SLACK_APPROVER_URL}/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approval_id: approval!.id,
        card_id: cardId,
        task: representative,
        reason: `Cluster of ${cluster.size} similar user requests on ${surface.id}.`
      })
    }).catch(e => console.error("cluster-bake notify failed:", e));

    return NextResponse.json({ ok: true, card_id: cardId });
  }
  return { POST };
}

export function createBakeCandidateDismissHandler(_opts: { surface: Surface }) {
  async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    await query("UPDATE bake_clusters SET status = 'dismissed' WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  }
  return { POST };
}
