import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { Surface } from "../surface";
import { getOrCreateSession } from "../session";
import { one, query, withClient } from "../db";

export function createShareHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function POST(req: Request) {
    const sid = await getOrCreateSession(surface.id);
    let body: any = {};
    try { body = await req.json(); } catch {}

    let patches: any[] = [];
    let originCardId: string | null = null;

    if (body.card_id) {
      const rows = await query<{ body: any }>(
        "SELECT body FROM patches WHERE card_id = $1 AND session_id = $2 AND surface_id = $3",
        [body.card_id, sid, surface.id]
      );
      if (rows.length === 0) return NextResponse.json({ error: "no patches on that card" }, { status: 404 });
      patches = rows.map(r => r.body);
      originCardId = body.card_id;
    } else {
      const rows = await query<{ body: any }>(
        "SELECT body FROM patches WHERE session_id = $1 AND surface_id = $2 AND active = true ORDER BY created_at ASC",
        [sid, surface.id]
      );
      if (rows.length === 0) return NextResponse.json({ error: "no active patches in this session" }, { status: 404 });
      patches = rows.map(r => r.body);
    }

    const token = crypto.randomBytes(9).toString("base64url");
    await one(
      `INSERT INTO shares (token, origin_session, origin_card_id, patches)
       VALUES ($1, $2, $3, $4)`,
      [token, sid, originCardId, JSON.stringify(patches)]
    );

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.json({ ok: true, token, url: `${origin}/apply/${token}` });
  }

  return { POST };
}

export function createApplyShareHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
    const { token } = await ctx.params;
    const sid = await getOrCreateSession(surface.id);

    const share = await one<{
      id: string; patches: any[]; origin_card_id: string | null;
    }>("SELECT id, patches, origin_card_id FROM shares WHERE token = $1", [token]);
    if (!share) {
      return NextResponse.redirect(new URL("/?share=invalid", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
    }

    await withClient(async client => {
      await client.query("BEGIN");
      try {
        for (const patch of share.patches) {
          const c = await client.query<{ id: string }>(
            `INSERT INTO cards (session_id, task_text, status, lane, kind, library_tier, surface_id, surface)
             VALUES ($1, $2, 'applied', 'soft', 'adapt', 'soft-patch-reusable', $3, $4) RETURNING id`,
            [sid, `Shared adaptation`, surface.id, JSON.stringify(surface)]
          );
          const cardId = c.rows[0].id;
          await client.query(
            "INSERT INTO patches (session_id, card_id, body, active, surface_id) VALUES ($1, $2, $3, true, $4)",
            [sid, cardId, JSON.stringify(patch), surface.id]
          );
          await client.query(
            "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.done', $2)",
            [cardId, JSON.stringify({ text: "Applied from share link." })]
          );
        }
        await client.query("UPDATE shares SET applied_count = applied_count + 1 WHERE id = $1", [share.id]);
        await client.query("COMMIT");
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    });

    return NextResponse.redirect(new URL("/?share=applied", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  return { GET };
}
