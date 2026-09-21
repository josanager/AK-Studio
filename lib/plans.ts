import { env } from "cloudflare:workers";
import type { AppUser } from "../app/auth";

export type PlanName = "free" | "pro";
export type PlanSnapshot = { plan: PlanName; usedThisWeek: number; weeklyLimit: number | null; canCreate: boolean };

export function currentWeekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function ensureAppUser(user: AppUser) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,updated_at=excluded.updated_at")
    .bind(user.userId, user.email, user.displayName, now, now).run();
}

export async function getPlanSnapshot(user: AppUser): Promise<PlanSnapshot> {
  await ensureAppUser(user);
  const now = Math.floor(Date.now() / 1000);
  const subscription = await env.DB.prepare("SELECT plan,status,current_period_end FROM subscriptions WHERE user_id=? LIMIT 1")
    .bind(user.userId).first<{ plan: string; status: string; current_period_end: number | null }>();
  const pro = subscription?.plan === "pro" && ["active", "trialing"].includes(subscription.status) && (!subscription.current_period_end || subscription.current_period_end > now);
  const usage = await env.DB.prepare("SELECT COUNT(*) AS total FROM weekly_usage WHERE user_id=? AND week_key=? AND status IN ('processing','completed')")
    .bind(user.userId, currentWeekKey()).first<{ total: number }>();
  const usedThisWeek = Number(usage?.total || 0);
  return { plan: pro ? "pro" : "free", usedThisWeek, weeklyLimit: pro ? null : 1, canCreate: pro || usedThisWeek < 1 };
}
