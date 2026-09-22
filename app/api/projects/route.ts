import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../auth";
import { ensureAppUser, getPlanSnapshot } from "../../../lib/plans";
import {
  PROJECT_TTL_SECONDS,
  parseStudioProject,
  type SavedProjectSummary,
  type StudioProjectState,
} from "../../../lib/studio-project";

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function purgeExpired(userId: string) {
  const now = nowSec();
  await env.DB.prepare("DELETE FROM projects WHERE user_id=? AND expires_at IS NOT NULL AND expires_at<=?")
    .bind(userId, now)
    .run()
    .catch(() => undefined);
}

function summarize(row: {
  id: string;
  name: string;
  updated_at: number;
  expires_at: number | null;
  timeline_json: string;
}): SavedProjectSummary {
  const state = parseStudioProject(row.timeline_json);
  return {
    id: row.id,
    name: row.name,
    updatedAt: Number(row.updated_at) || 0,
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    title: state?.track.title || row.name,
    artist: state?.track.artist || "",
    hasAudio: Boolean(state?.audioId || state?.backingUrl || state?.audioUrl),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to view saved projects." }, { status: 401 });
  await ensureAppUser(user);
  await purgeExpired(user.userId);
  const result = await env.DB.prepare(
    "SELECT id,name,updated_at,expires_at,timeline_json FROM projects WHERE user_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY updated_at DESC LIMIT 50",
  )
    .bind(user.userId, nowSec())
    .all<{ id: string; name: string; updated_at: number; expires_at: number | null; timeline_json: string }>();
  const projects = (result.results || []).map(summarize);
  return Response.json({ projects, ttlSeconds: PROJECT_TTL_SECONDS });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in to save a project." }, { status: 401 });
  await ensureAppUser(user);
  const plan = await getPlanSnapshot(user);
  await purgeExpired(user.userId);

  const body = (await request.json()) as {
    id?: string | null;
    name?: string;
    state?: StudioProjectState;
  };
  if (!body.state || typeof body.state !== "object") {
    return Response.json({ error: "Missing project state." }, { status: 400 });
  }

  const state = body.state;
  const name = (body.name || state.track?.title || "Untitled project").slice(0, 120) || "Untitled project";
  const timelineJson = JSON.stringify(state);
  const now = nowSec();
  const expiresAt = now + PROJECT_TTL_SECONDS;

  // Free: one draft slot — overwrite the existing non-expired project.
  if (plan.plan === "free") {
    const existing = await env.DB.prepare(
      "SELECT id FROM projects WHERE user_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY updated_at DESC LIMIT 1",
    )
      .bind(user.userId, now)
      .first<{ id: string }>();

    const id = existing?.id || crypto.randomUUID();
    if (existing) {
      await env.DB.prepare(
        "UPDATE projects SET name=?, timeline_json=?, updated_at=?, expires_at=? WHERE id=? AND user_id=?",
      )
        .bind(name, timelineJson, now, expiresAt, id, user.userId)
        .run();
    } else {
      await env.DB.prepare(
        "INSERT INTO projects (id,user_id,name,timeline_json,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(id, user.userId, name, timelineJson, now, now, expiresAt)
        .run();
    }
    // Ensure free users never keep more than one row.
    await env.DB.prepare("DELETE FROM projects WHERE user_id=? AND id!=?")
      .bind(user.userId, id)
      .run()
      .catch(() => undefined);

    return Response.json({
      id,
      name,
      expiresAt,
      updatedAt: now,
      overwritten: Boolean(existing),
      plan: plan.plan,
      message: existing
        ? "Free plan keeps one project for 24 hours. Your draft was updated."
        : "Project saved for 24 hours.",
    });
  }

  // Pro: upsert by id when provided, else create.
  let id = typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (id) {
    const owned = await env.DB.prepare("SELECT id FROM projects WHERE id=? AND user_id=? LIMIT 1")
      .bind(id, user.userId)
      .first<{ id: string }>();
    if (!owned) id = null;
  }
  if (id) {
    await env.DB.prepare(
      "UPDATE projects SET name=?, timeline_json=?, updated_at=?, expires_at=? WHERE id=? AND user_id=?",
    )
      .bind(name, timelineJson, now, expiresAt, id, user.userId)
      .run();
  } else {
    id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO projects (id,user_id,name,timeline_json,created_at,updated_at,expires_at) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(id, user.userId, name, timelineJson, now, now, expiresAt)
      .run();
  }

  return Response.json({
    id,
    name,
    expiresAt,
    updatedAt: now,
    overwritten: false,
    plan: plan.plan,
    message: "Project saved for 24 hours.",
  });
}
