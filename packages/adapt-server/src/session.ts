import { cookies } from "next/headers";
import { one } from "./db";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "adapt_sid";

/**
 * Reads the session cookie (set by middleware) and ensures a sessions row exists.
 * Server-component safe: never writes cookies (middleware does that).
 *
 * Optional surfaceId tags a freshly-created session with the calling app. If the
 * session already exists, the surface_id on the row is left alone (sessions stick
 * to their first surface).
 */
export async function getOrCreateSession(surfaceId?: string): Promise<string> {
  const store = await cookies();
  const sid = store.get(COOKIE_NAME)?.value;
  if (!sid) {
    return ensureSession(crypto.randomUUID(), surfaceId);
  }
  return ensureSession(sid, surfaceId);
}

export async function getSessionIdOrNull(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

async function ensureSession(id: string, surfaceId?: string): Promise<string> {
  // On conflict, do not change surface_id — sessions stay bound to their original app.
  const row = await one<{ id: string }>(
    surfaceId
      ? `INSERT INTO sessions (id, surface_id) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET last_seen_at = now()
         RETURNING id`
      : `INSERT INTO sessions (id) VALUES ($1)
         ON CONFLICT (id) DO UPDATE SET last_seen_at = now()
         RETURNING id`,
    surfaceId ? [id, surfaceId] : [id]
  );
  return row!.id;
}
