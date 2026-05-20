import pg from "pg";
import type { Surface } from "../surface";
import { getSessionIdOrNull } from "../session";

export function createStreamHandler(opts: { surface: Surface }) {
  const surface = opts.surface;

  async function GET() {
    const sid = await getSessionIdOrNull();
    if (!sid) return new Response("no session", { status: 401 });

    const encoder = new TextEncoder();
    let closed = false;

    const listener = new pg.Client({ connectionString: process.env.DATABASE_URL });
    const fetcher  = new pg.Client({ connectionString: process.env.DATABASE_URL });

    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (chunk: string) => {
          if (closed) return;
          try { controller.enqueue(encoder.encode(chunk)); }
          catch { closed = true; }
        };
        const send = (event: string, data: any) => {
          enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try { await listener.connect(); await fetcher.connect(); }
        catch {
          send("error", { message: "db connect failed" });
          try { controller.close(); } catch {}
          return;
        }

        send("hello", { ok: true, surface: surface.id });

        const hb = setInterval(() => enqueue(`: ping\n\n`), 20_000);

        listener.on("notification", async (msg) => {
          if (closed) return;
          try {
            if (msg.channel === "cards_new" && msg.payload) {
              const r = await fetcher.query(
                "SELECT 1 FROM cards WHERE id=$1 AND session_id=$2 AND surface_id=$3",
                [msg.payload, sid, surface.id]
              );
              if (r.rowCount) send("card.new", { card_id: msg.payload });
              return;
            }
            if (msg.channel === "card_events" && msg.payload) {
              const payload = JSON.parse(msg.payload);
              const ev = await fetcher.query(
                "SELECT kind, payload FROM card_events WHERE id = $1",
                [payload.event_id]
              );
              if (!ev.rowCount) return;
              const owns = await fetcher.query(
                "SELECT 1 FROM cards WHERE id=$1 AND session_id=$2 AND surface_id=$3",
                [payload.card_id, sid, surface.id]
              );
              if (!owns.rowCount) return;
              send("card.update", { card_id: payload.card_id, kind: ev.rows[0].kind, payload: ev.rows[0].payload });
            }
          } catch { /* swallow */ }
        });

        await listener.query("LISTEN card_events");
        await listener.query("LISTEN cards_new");

        const cleanup = async () => {
          if (closed) return;
          closed = true;
          clearInterval(hb);
          try { await listener.end(); } catch {}
          try { await fetcher.end(); } catch {}
          try { controller.close(); } catch {}
        };

        listener.on("error", cleanup);
        fetcher.on("error", cleanup);
      },
      async cancel() {
        closed = true;
        try { await listener.end(); } catch {}
        try { await fetcher.end(); } catch {}
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  }

  return { GET };
}
