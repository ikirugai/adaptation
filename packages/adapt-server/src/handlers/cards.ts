import { NextResponse } from "next/server";
import type { Surface } from "../surface";
import { getOrCreateSession, getSessionIdOrNull } from "../session";
import { one, query, withClient } from "../db";

const RUNNER_URL = process.env.RUNNER_URL || "http://claude-runner:8080";
const SLACK_APPROVER_URL = process.env.SLACK_APPROVER_URL || "http://slack-approver:8090";

export function createCardsHandlers(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function GET() {
    const sid = await getOrCreateSession(surface.id);
    const cards = await query<any>(`
      SELECT
        c.*,
        (SELECT row_to_json(le) FROM (
          SELECT kind, payload FROM card_events
          WHERE card_id = c.id ORDER BY id DESC LIMIT 1
        ) le) AS last_event,
        (SELECT json_agg(t ORDER BY t.created_at DESC) FROM (
          SELECT kind, payload, created_at FROM card_events
          WHERE card_id = c.id ORDER BY id DESC LIMIT 5
        ) t) AS events_tail
      FROM cards c
      WHERE c.session_id = $1 AND c.surface_id = $2
      ORDER BY c.created_at DESC
      LIMIT 50
    `, [sid, surface.id]);
    return NextResponse.json({ cards });
  }

  async function POST(req: Request) {
    const sid = await getOrCreateSession(surface.id);
    const body = await req.json();
    const task = String(body.task_text || "").trim().slice(0, 2000);
    if (!task) return NextResponse.json({ error: "task_text required" }, { status: 400 });

    const recent = await one<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM cards WHERE session_id = $1 AND created_at > now() - interval '60 seconds'",
      [sid]
    );
    if (recent && recent.n >= 8) {
      return NextResponse.json({ error: "rate limited; slow down" }, { status: 429 });
    }

    const card = await one<{ id: string }>(`
      INSERT INTO cards (session_id, task_text, snip_selector, snip_bbox, snip_image, status, surface_id, surface)
      VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)
      RETURNING id
    `, [
      sid,
      task,
      body.snip_selector || null,
      body.snip_bbox ? JSON.stringify(body.snip_bbox) : null,
      body.snip_image ? String(body.snip_image).slice(0, 200_000) : null,
      surface.id,
      JSON.stringify(surface)
    ]);

    await query(
      "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.queued', $2)",
      [card!.id, JSON.stringify({ text: "Queued" })]
    );

    return NextResponse.json({ card_id: card!.id });
  }

  return { GET, POST };
}

export function createCardByIdHandlers(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const sid = await getSessionIdOrNull();
    if (!sid) return new Response("no session", { status: 401 });

    const card = await one<{
      id: string; status: string; lane: string | null;
      commit_sha: string | null; task_text: string; kind: string;
    }>(
      "SELECT id, status, lane, commit_sha, task_text, kind FROM cards WHERE id = $1 AND session_id = $2 AND surface_id = $3",
      [id, sid, surface.id]
    );
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (card.lane === "hard" && card.status === "deployed") {
      if (!card.commit_sha) {
        return NextResponse.json({ error: "Card has no commit_sha — cannot revert." }, { status: 400 });
      }
      if (card.kind === "revert") {
        return NextResponse.json({ error: "Cannot undo an undo." }, { status: 400 });
      }
      const revertCardId = await withClient(async client => {
        await client.query("BEGIN");
        try {
          const r = await client.query<{ id: string }>(
            `INSERT INTO cards (session_id, task_text, status, lane, kind, parent_card_id, surface_id, surface)
             VALUES ($1, $2, 'running', 'hard', 'revert', $3, $4, $5) RETURNING id`,
            [sid, `Revert: ${card.task_text.slice(0, 100)}`, id, surface.id, JSON.stringify(surface)]
          );
          const newId = r.rows[0].id;
          await client.query(
            "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.queued', $2)",
            [newId, JSON.stringify({ text: "Revert queued — dispatching to runner." })]
          );
          await client.query("COMMIT");
          return newId;
        } catch (e) { await client.query("ROLLBACK"); throw e; }
      });

      fetch(`${RUNNER_URL}/revert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          card_id: revertCardId,
          commit_sha: card.commit_sha,
          original_prompt: card.task_text
        })
      }).catch(e => console.error("revert dispatch failed:", e));

      return NextResponse.json({ ok: true, revert_card_id: revertCardId });
    }

    await withClient(async client => {
      await client.query("BEGIN");
      try {
        await client.query("UPDATE patches SET active = false WHERE card_id = $1", [id]);
        const newStatus = (card.status === "applied" || card.status === "done")
          ? "undone"
          : (card.status === "failed" || card.status === "rejected")
            ? card.status
            : "cancelled";
        await client.query("UPDATE cards SET status = $2, updated_at = now() WHERE id = $1", [id, newStatus]);
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.update', $2)",
          [id, JSON.stringify({ kind: "page.refresh", text: newStatus === "undone" ? "Undone" : "Cancelled" })]
        );
        await client.query("COMMIT");
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    });

    return NextResponse.json({ ok: true });
  }

  return { DELETE };
}

export function createCardRedoHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const sid = await getSessionIdOrNull();
    if (!sid) return new Response("no session", { status: 401 });

    const card = await one<{ id: string; status: string; lane: string | null }>(
      "SELECT id, status, lane FROM cards WHERE id = $1 AND session_id = $2 AND surface_id = $3",
      [id, sid, surface.id]
    );
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (card.lane !== "soft" || (card.status !== "undone" && card.status !== "cancelled")) {
      return NextResponse.json({ error: "Only undone soft cards can be redone." }, { status: 400 });
    }

    const result = await withClient(async client => {
      await client.query("BEGIN");
      try {
        const r = await client.query("UPDATE patches SET active = true WHERE card_id = $1", [id]);
        if (!r.rowCount) {
          await client.query("ROLLBACK");
          return { reactivated: 0 };
        }
        await client.query("UPDATE cards SET status = 'applied', updated_at = now() WHERE id = $1", [id]);
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.update', $2)",
          [id, JSON.stringify({ kind: "page.refresh", text: "Re-applied" })]
        );
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.done', $2)",
          [id, JSON.stringify({ text: "Re-applied." })]
        );
        await client.query("COMMIT");
        return { reactivated: r.rowCount };
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    });

    if (result.reactivated === 0) {
      return NextResponse.json({ error: "Nothing to redo — this card never produced a patch." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return { POST };
}

export function createCardBakeHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const sid = await getSessionIdOrNull();
    if (!sid) return new Response("no session", { status: 401 });

    const card = await one<{ task_text: string; status: string; lane: string | null }>(
      "SELECT task_text, status, lane FROM cards WHERE id = $1 AND session_id = $2 AND surface_id = $3",
      [id, sid, surface.id]
    );
    if (!card) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (card.lane !== "soft") return NextResponse.json({ error: "only soft cards can be baked" }, { status: 400 });
    if (!["applied", "done"].includes(card.status)) {
      return NextResponse.json({ error: "card must be applied to be baked" }, { status: 400 });
    }

    const prompt =
      `Implement the following adaptation as a permanent default in the codebase, baked for every user:\n\n` +
      `"${card.task_text}"\n\n` +
      `This was previously achieved via a per-user soft patch. Now we want it to be the default behaviour. ` +
      `The originating app is "${surface.id}" — edit its source so this is on for everyone.`;

    const bake = await one<{ id: string }>(
      `INSERT INTO cards (session_id, task_text, status, lane, kind, parent_card_id, surface_id, surface)
       VALUES ($1, $2, 'awaiting_approval', 'hard', 'bake', $3, $4, $5) RETURNING id`,
      [sid, `Bake: ${card.task_text.slice(0, 100)}`, id, surface.id, JSON.stringify(surface)]
    );
    const bakeId = bake!.id;

    await query(
      "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.queued', $2)",
      [bakeId, JSON.stringify({ text: "Bake requested — routing to Slack for approval." })]
    );
    const approval = await one<{ id: string }>(
      `INSERT INTO approvals (card_id, proposed_prompt, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [bakeId, prompt]
    );
    await query("UPDATE cards SET approval_id = $1 WHERE id = $2", [approval!.id, bakeId]);

    fetch(`${SLACK_APPROVER_URL}/notify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approval_id: approval!.id,
        card_id: bakeId,
        task: card.task_text,
        reason: `User chose to bake this soft adaptation for everyone on ${surface.id}.`
      })
    }).catch(e => console.error("bake notify failed:", e));

    return NextResponse.json({ ok: true, bake_card_id: bakeId });
  }

  return { POST };
}
