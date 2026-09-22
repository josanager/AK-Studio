import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../../auth";
import { ensureAppUser } from "../../../../lib/plans";
import { parseStudioProject, PROJECT_TTL_SECONDS } from "../../../../lib/studio-project";

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to open a project." }, { status: 401 });
  await ensureAppUser(user);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const row = await env.DB.prepare(
    "SELECT id,name,updated_at,expires_at,timeline_json FROM projects WHERE id=? AND user_id=? LIMIT 1",
  )
    .bind(id, user.userId)
    .first<{ id: string; name: string; updated_at: number; expires_at: number | null; timeline_json: string }>();

  if (!row) return Response.json({ error: "Project not found." }, { status: 404 });
  if (row.expires_at != null && Number(row.expires_at) <= nowSec()) {
    await env.DB.prepare("DELETE FROM projects WHERE id=?").bind(id).run().catch(() => undefined);
    return Response.json({ error: "This saved project expired after 24 hours." }, { status: 410 });
  }

  const state = parseStudioProject(row.timeline_json);
  if (!state) return Response.json({ error: "Project data is invalid." }, { status: 500 });

  return Response.json({
    id: row.id,
    name: row.name,
    updatedAt: Number(row.updated_at),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    ttlSeconds: PROJECT_TTL_SECONDS,
    state,
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to delete a project." }, { status: 401 });
  await ensureAppUser(user);
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const result = await env.DB.prepare("DELETE FROM projects WHERE id=? AND user_id=?")
    .bind(id, user.userId)
    .run();
  const removed = Number((result as { meta?: { changes?: number }; changes?: number }).meta?.changes ?? (result as { changes?: number }).changes ?? 0);
  if (removed < 1) return Response.json({ error: "Project not found." }, { status: 404 });
  return Response.json({ ok: true, deleted: id });
}
