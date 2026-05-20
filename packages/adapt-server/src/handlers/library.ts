import { NextResponse } from "next/server";
import type { Surface } from "../surface";
import { getOrCreateSession } from "../session";
import { one, query, withClient } from "../db";

export function createLibraryHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function GET() {
    const rows = await query<{
      id: string;
      tier: "baked-default" | "baked-feature" | "soft-patch-reusable";
      task_canonical: string;
      what_it_does: string;
      feature_flag: string | null;
      popularity: number;
    }>(`
      SELECT id, tier, task_canonical, what_it_does, feature_flag, popularity
      FROM library_entries
      WHERE surface_id = $1
      ORDER BY tier ASC, popularity DESC, created_at DESC
      LIMIT 100
    `, [surface.id]);
    return NextResponse.json({ entries: rows });
  }

  return { GET };
}

export function createLibraryApplyHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const sid = await getOrCreateSession(surface.id);

    const entry = await one<{
      id: string;
      tier: "baked-default" | "baked-feature" | "soft-patch-reusable";
      task_canonical: string;
      what_it_does: string;
      feature_flag: string | null;
      patch_body: any | null;
      surface_id: string;
    }>(
      `SELECT id, tier, task_canonical, what_it_does, feature_flag, patch_body, surface_id
       FROM library_entries WHERE id = $1`,
      [id]
    );
    if (!entry) return NextResponse.json({ error: "library entry not found" }, { status: 404 });
    if (entry.surface_id !== surface.id) {
      return NextResponse.json({ error: "library entry belongs to a different surface" }, { status: 400 });
    }

    let patch: any = null;
    if (entry.tier === "baked-default") {
      // No patch — already the default.
    } else if (entry.tier === "baked-feature" && entry.feature_flag) {
      patch = { ops: [{ op: "feature_flag", flag: entry.feature_flag, enabled: true }] };
    } else if (entry.tier === "soft-patch-reusable" && entry.patch_body) {
      patch = entry.patch_body;
    } else {
      return NextResponse.json({ error: "library entry is not applicable" }, { status: 400 });
    }

    const cardId = await withClient(async client => {
      await client.query("BEGIN");
      try {
        const c = await client.query<{ id: string }>(
          `INSERT INTO cards (session_id, task_text, status, lane, library_tier, library_hits, kind, surface_id, surface)
           VALUES ($1, $2, $3, 'soft', $4, $5, 'adapt', $6, $7) RETURNING id`,
          [sid, entry.task_canonical, patch ? "applied" : "done", entry.tier,
           JSON.stringify([{ id: entry.id, classification: "library-apply" }]),
           surface.id, JSON.stringify(surface)]
        );
        const newCardId = c.rows[0].id;
        if (patch) {
          await client.query(
            "INSERT INTO patches (session_id, card_id, body, active, surface_id) VALUES ($1, $2, $3, true, $4)",
            [sid, newCardId, JSON.stringify(patch), surface.id]
          );
        }
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.update', $2)",
          [newCardId, JSON.stringify({ text: `Applied from library: ${entry.what_it_does}` })]
        );
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.update', $2)",
          [newCardId, JSON.stringify({ kind: "page.refresh" })]
        );
        await client.query(
          "INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.done', $2)",
          [newCardId, JSON.stringify({ text: `Applied: ${entry.what_it_does}` })]
        );
        await client.query("COMMIT");
        return newCardId;
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    });

    await query("UPDATE library_entries SET popularity = popularity + 1, updated_at = now() WHERE id = $1", [id]);

    return NextResponse.json({ ok: true, card_id: cardId });
  }

  return { POST };
}
