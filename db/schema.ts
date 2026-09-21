import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const authUser = sqliteTable("auth_user", { id:text("id").primaryKey(), name:text("name").notNull(), email:text("email").notNull().unique(), emailVerified:integer("email_verified",{mode:"boolean"}).notNull().default(false), image:text("image"), createdAt:integer("created_at",{mode:"timestamp"}).notNull(), updatedAt:integer("updated_at",{mode:"timestamp"}).notNull() });
export const authSession = sqliteTable("auth_session", { id:text("id").primaryKey(), expiresAt:integer("expires_at",{mode:"timestamp"}).notNull(), token:text("token").notNull().unique(), createdAt:integer("created_at",{mode:"timestamp"}).notNull(), updatedAt:integer("updated_at",{mode:"timestamp"}).notNull(), ipAddress:text("ip_address"), userAgent:text("user_agent"), userId:text("user_id").notNull().references(()=>authUser.id,{onDelete:"cascade"}) });
export const authAccount = sqliteTable("auth_account", { id:text("id").primaryKey(), accountId:text("account_id").notNull(), providerId:text("provider_id").notNull(), userId:text("user_id").notNull().references(()=>authUser.id,{onDelete:"cascade"}), accessToken:text("access_token"), refreshToken:text("refresh_token"), idToken:text("id_token"), accessTokenExpiresAt:integer("access_token_expires_at",{mode:"timestamp"}), refreshTokenExpiresAt:integer("refresh_token_expires_at",{mode:"timestamp"}), scope:text("scope"), password:text("password"), createdAt:integer("created_at",{mode:"timestamp"}).notNull(), updatedAt:integer("updated_at",{mode:"timestamp"}).notNull() });
export const authVerification = sqliteTable("auth_verification", { id:text("id").primaryKey(), identifier:text("identifier").notNull(), value:text("value").notNull(), expiresAt:integer("expires_at",{mode:"timestamp"}).notNull(), createdAt:integer("created_at",{mode:"timestamp"}), updatedAt:integer("updated_at",{mode:"timestamp"}) });

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("idx_users_email").on(table.email)]);

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  timelineJson: text("timeline_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("idx_projects_user_name").on(table.userId, table.name)]);

export const apiCredentials = sqliteTable("api_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text("iv").notNull(),
  lastFour: text("last_four").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("idx_api_credentials_user_provider").on(table.userId, table.provider)]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("inactive"),
  plan: text("plan").notNull().default("free"),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, table => [uniqueIndex("idx_subscriptions_user").on(table.userId)]);
