import { NextResponse } from "next/server";
import type { Surface } from "../surface";
import { getSessionIdOrNull } from "../session";
import { withClient } from "../db";

export function createPatchesHandlers(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function DELETE() {
    const sid = await getSessionIdOrNull();
    if (!sid) return new Response("no session", { status: 401 });

    const result = await withClient(async client => {
      await client.query("BEGIN");
      try {
        const deactivated = await client.query<{ card_id: string | null }>(
          `UPDATE patches SET active = false
           WHERE session_id = $1 AND surface_id = $2 AND active = true
           RETURNING card_id`,
          [sid, surface.id]
        );
        const cardIds = deactivated.rows.map(r => r.card_id).filter(Boolean) as string[];
        if (cardIds.length) {
          await client.query(
            `UPDATE cards SET status = 'undone', updated_at = now()
             WHERE id = ANY($1::uuid[]) AND status IN ('applied','deployed','done')`,
            [cardIds]
          );
          for (const cid of cardIds) {
            await client.query(
              `INSERT INTO card_events (card_id, kind, payload) VALUES ($1, 'card.update', $2)`,
              [cid, JSON.stringify({ kind: "page.refresh", text: "Reset" })]
            );
          }
        }
        await client.query("COMMIT");
        return { patches: deactivated.rowCount ?? 0, cards: cardIds.length };
      } catch (e) { await client.query("ROLLBACK"); throw e; }
    });

    return NextResponse.json({ ok: true, ...result });
  }

  return { DELETE };
}
