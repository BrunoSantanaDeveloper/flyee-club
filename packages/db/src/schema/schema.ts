// GENERATED from packages/db/migrations by `npm run db:schema:pull`.
// Regenerate after every migration instead of editing by hand.
import { customType, pgSchema, pgTable, uniqueIndex, foreignKey, pgPolicy, check, uuid, text, boolean, timestamp, unique, index, jsonb, integer, bigint, type AnyPgColumn, primaryKey, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

const authSchema = pgSchema("auth");

/** Stub of the Supabase auth table: only what the foreign keys reference. */
export const users = authSchema.table("users", {
	id: uuid().primaryKey().notNull(),
});
export const usersInAuth = users;

const citext = customType<{ data: string }>({
	dataType() {
		return "citext";
	},
});

export const aiTool = pgEnum("ai_tool", ['claude_code', 'codex', 'gemini_cli', 'cursor', 'other'])
export const announcementLevel = pgEnum("announcement_level", ['info', 'warning', 'critical'])
export const billingPeriod = pgEnum("billing_period", ['weekly', 'monthly', 'yearly'])
export const billingProvider = pgEnum("billing_provider", ['stripe', 'asaas'])
export const blogCommentStatus = pgEnum("blog_comment_status", ['pending', 'approved', 'rejected'])
export const couponDuration = pgEnum("coupon_duration", ['once', 'repeating', 'forever'])
export const discountType = pgEnum("discount_type", ['percent', 'fixed'])
export const invoiceStatus = pgEnum("invoice_status", ['open', 'paid', 'failed', 'refunded', 'void'])
export const memberSegment = pgEnum("member_segment", ['produto', 'agencia', 'negocio', 'dev', 'outro'])
export const moduleKind = pgEnum("module_kind", ['recurring', 'one_time'])
export const orgRole = pgEnum("org_role", ['owner', 'admin', 'member'])
export const planKind = pgEnum("plan_kind", ['recurring', 'access'])
export const subscriptionCancelReason = pgEnum("subscription_cancel_reason", ['too_expensive', 'not_using', 'missing_tool', 'switched', 'technical', 'temporary', 'other'])
export const subscriptionStatus = pgEnum("subscription_status", ['incomplete', 'trialing', 'active', 'past_due', 'canceled'])


export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	displayName: text("display_name"),
	avatarUrl: text("avatar_url"),
	isSuperadmin: boolean("is_superadmin").default(false).notNull(),
	segment: memberSegment(),
	aiTool: aiTool("ai_tool"),
	locale: text().default('pt-BR').notNull(),
	timezone: text().default('America/Sao_Paulo').notNull(),
	marketingEmailOptOut: boolean("marketing_email_opt_out").default(false).notNull(),
	emailUnsubscribeToken: uuid("email_unsubscribe_token").defaultRandom().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("profiles_email_unsubscribe_token_idx").using("btree", table.emailUnsubscribeToken.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("profiles_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(id = auth.uid())` }),
	pgPolicy("profiles_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("profiles_update_own", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("profiles_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("profiles_display_name_length", sql`(display_name IS NULL) OR (char_length(display_name) <= 120)`),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	createdBy: uuid("created_by"),
	billingCpfCnpj: text("billing_cpf_cnpj"),
	billingPostalCode: text("billing_postal_code"),
	billingAddressNumber: text("billing_address_number"),
	billingPhone: text("billing_phone"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "organizations_created_by_fkey"
		}).onDelete("set null"),
	unique("organizations_slug_key").on(table.slug),
	pgPolicy("organizations_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_org_member(id)` }),
	pgPolicy("organizations_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("organizations_update_owner", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("organizations_billing_cpf_cnpj_check", sql`(billing_cpf_cnpj IS NULL) OR (billing_cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$'::text)`),
	check("organizations_billing_postal_code_check", sql`(billing_postal_code IS NULL) OR (billing_postal_code ~ '^[0-9]{8}$'::text)`),
	check("organizations_billing_phone_check", sql`(billing_phone IS NULL) OR (billing_phone ~ '^[0-9]{10,11}$'::text)`),
]);

export const memberships = pgTable("memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: orgRole().default('member').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("memberships_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	index("memberships_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "memberships_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "memberships_user_id_fkey"
		}).onDelete("cascade"),
	unique("memberships_org_id_user_id_key").on(table.orgId, table.userId),
	pgPolicy("memberships_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_org_member(org_id)` }),
	pgPolicy("memberships_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const auditEvents = pgTable("audit_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id"),
	actorId: uuid("actor_id"),
	action: text().notNull(),
	entityType: text("entity_type"),
	entityId: text("entity_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_events_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("audit_events_entity_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("audit_events_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "audit_events_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "audit_events_actor_id_fkey"
		}).onDelete("set null"),
	pgPolicy("audit_events_insert_member", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((actor_id = auth.uid()) AND (is_superadmin() OR ((org_id IS NOT NULL) AND is_org_member(org_id))))`  }),
	pgPolicy("audit_events_select_admin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const recordVersions = pgTable("record_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tableName: text("table_name").notNull(),
	recordId: uuid("record_id").notNull(),
	orgId: uuid("org_id"),
	operation: text().notNull(),
	data: jsonb().notNull(),
	changedBy: uuid("changed_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("record_versions_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")).where(sql`(org_id IS NOT NULL)`),
	index("record_versions_record_idx").using("btree", table.tableName.asc().nullsLast().op("timestamptz_ops"), table.recordId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	pgPolicy("record_versions_select_admin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_superadmin() OR ((org_id IS NOT NULL) AND has_org_role(org_id, ARRAY['owner'::org_role, 'admin'::org_role])))` }),
	check("record_versions_operation_check", sql`operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])`),
]);

export const consentTerms = pgTable("consent_terms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	locale: text().default('pt-BR').notNull(),
	version: integer().default(1).notNull(),
	title: text().notNull(),
	bodyMd: text("body_md").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("consent_terms_one_active_idx").using("btree", table.slug.asc().nullsLast().op("text_ops"), table.locale.asc().nullsLast().op("text_ops")).where(sql`is_active`),
	unique("consent_terms_slug_locale_version_key").on(table.slug, table.locale, table.version),
	pgPolicy("consent_terms_select_active", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`is_active` }),
	pgPolicy("consent_terms_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("consent_terms_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("consent_terms_slug_check", sql`slug ~ '^[a-z][a-z0-9-]{1,39}$'::text`),
	check("consent_terms_version_check", sql`version >= 1`),
]);

export const consentAcceptances = pgTable("consent_acceptances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	termId: uuid("term_id").notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	metadata: jsonb().default({}).notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("consent_acceptances_one_current_idx").using("btree", table.termId.asc().nullsLast().op("uuid_ops"), table.userId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	index("consent_acceptances_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	index("consent_acceptances_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.acceptedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.termId],
			foreignColumns: [consentTerms.id],
			name: "consent_acceptances_term_id_fkey"
		}),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "consent_acceptances_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "consent_acceptances_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("consent_acceptances_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("consent_acceptances_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const accessEvents = pgTable("access_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	ip: text(),
	userAgent: text("user_agent"),
	aal: text(),
	sessionId: uuid("session_id"),
	impersonatedBy: uuid("impersonated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("access_events_created_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("access_events_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("access_events_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "access_events_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.impersonatedBy],
			foreignColumns: [profiles.id],
			name: "access_events_impersonated_by_fkey"
		}).onDelete("set null"),
	pgPolicy("access_events_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("access_events_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const platformSettings = pgTable("platform_settings", {
	key: text().primaryKey().notNull(),
	value: jsonb().default({}).notNull(),
	isPublic: boolean("is_public").default(false).notNull(),
	updatedBy: uuid("updated_by"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [profiles.id],
			name: "platform_settings_updated_by_fkey"
		}).onDelete("set null"),
	pgPolicy("platform_settings_select_public", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`is_public` }),
	pgPolicy("platform_settings_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("platform_settings_key_check", sql`key ~ '^[a-z][a-z0-9_]{1,39}$'::text`),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().default('system').notNull(),
	title: text().notNull(),
	body: text(),
	href: text(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	sourceKey: text("source_key"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("notifications_source_key_unique_idx").using("btree", table.sourceKey.asc().nullsLast().op("text_ops")).where(sql`(source_key IS NOT NULL)`),
	index("notifications_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "notifications_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("notifications_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("notifications_update_own", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const announcements = pgTable("announcements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	body: text(),
	level: announcementLevel().default('info').notNull(),
	href: text(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "announcements_created_by_fkey"
		}).onDelete("set null"),
	pgPolicy("announcements_select_live", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_superadmin() OR (is_active AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now()))))` }),
	pgPolicy("announcements_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
]);

export const onboardingState = pgTable("onboarding_state", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	flow: text().notNull(),
	completedSteps: jsonb("completed_steps").default([]).notNull(),
	dismissed: boolean().default(false).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("onboarding_state_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "onboarding_state_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "onboarding_state_org_id_fkey"
		}).onDelete("cascade"),
	unique("onboarding_state_user_id_org_id_flow_key").on(table.userId, table.orgId, table.flow),
	pgPolicy("onboarding_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((user_id = auth.uid()) AND ((org_id IS NULL) OR is_org_member(org_id)))` }),
	pgPolicy("onboarding_insert_own", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("onboarding_update_own", { as: "permissive", for: "update", to: ["authenticated"] }),
]);

export const backupRuns = pgTable("backup_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	status: text().default('running').notNull(),
	triggeredBy: text("triggered_by").default('manual').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	tableCount: integer("table_count").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rowCount: bigint("row_count", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalBytes: bigint("total_bytes", { mode: "number" }).default(0).notNull(),
	storagePrefix: text("storage_prefix"),
	error: text(),
}, (table) => [
	index("backup_runs_started_idx").using("btree", table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	pgPolicy("backup_runs_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("backup_runs_status_check", sql`status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text])`),
	check("backup_runs_triggered_by_check", sql`triggered_by = ANY (ARRAY['cron'::text, 'manual'::text])`),
]);

export const plans = pgTable("plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	kind: planKind().default('recurring').notNull(),
	family: text().notNull(),
	tier: text(),
	period: billingPeriod(),
	priceCents: integer("price_cents").default(0).notNull(),
	currency: text().default('BRL').notNull(),
	trialDays: integer("trial_days").default(0).notNull(),
	isFree: boolean("is_free").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	isAddon: boolean("is_addon").default(false).notNull(),
	limits: jsonb().default({}).notNull(),
	providerRefs: jsonb("provider_refs").default({}).notNull(),
	sort: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	accessMonths: integer("access_months"),
}, (table) => [
	uniqueIndex("plans_one_public_access_idx").using("btree", table.family.asc().nullsLast().op("text_ops"), table.currency.asc().nullsLast().op("text_ops")).where(sql`(is_public AND is_active AND (NOT is_addon) AND (period IS NULL))`),
	uniqueIndex("plans_one_public_recurring_idx").using("btree", table.family.asc().nullsLast().op("text_ops"), table.period.asc().nullsLast().op("enum_ops"), table.currency.asc().nullsLast().op("text_ops")).where(sql`(is_public AND is_active AND (NOT is_addon) AND (period IS NOT NULL))`),
	unique("plans_slug_key").on(table.slug),
	pgPolicy("plans_select", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_active OR is_superadmin())` }),
	pgPolicy("plans_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("plans_slug_check", sql`slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'::text`),
	check("plans_family_check", sql`family ~ '^[a-z0-9][a-z0-9-]{1,39}$'::text`),
	check("plans_tier_check", sql`(tier IS NULL) OR (tier = ANY (ARRAY['kit'::text, 'club'::text, 'pro'::text]))`),
	check("plans_currency_check", sql`currency = ANY (ARRAY['BRL'::text, 'USD'::text])`),
	check("plans_price_check", sql`price_cents >= 0`),
	check("plans_trial_check", sql`trial_days >= 0`),
	check("plans_free_price", sql`(NOT is_free) OR (price_cents = 0)`),
	check("plans_recurring_period", sql`(kind <> 'recurring'::plan_kind) OR (period IS NOT NULL)`),
	check("plans_access_no_period", sql`(kind <> 'access'::plan_kind) OR (period IS NULL)`),
	check("plans_access_months_check", sql`(access_months IS NULL) OR (access_months > 0)`),
	check("plans_access_months_kind", sql`(kind = 'access'::plan_kind) OR (access_months IS NULL)`),
]);

export const modules = pgTable("modules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	kind: moduleKind().default('recurring').notNull(),
	priceCents: integer("price_cents").default(0).notNull(),
	currency: text().default('BRL').notNull(),
	limits: jsonb().default({}).notNull(),
	providerRefs: jsonb("provider_refs").default({}).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	sort: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("modules_slug_key").on(table.slug),
	pgPolicy("modules_select", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_active OR is_superadmin())` }),
	pgPolicy("modules_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("modules_currency_check", sql`currency = ANY (ARRAY['BRL'::text, 'USD'::text])`),
]);

export const coupons = pgTable("coupons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: text().notNull(),
	description: text(),
	discountType: discountType("discount_type").notNull(),
	discountValue: integer("discount_value").notNull(),
	currency: text(),
	planFamilies: text("plan_families").array(),
	duration: couponDuration().default('once').notNull(),
	durationMonths: integer("duration_months"),
	maxRedemptions: integer("max_redemptions"),
	redeemedCount: integer("redeemed_count").default(0).notNull(),
	validUntil: timestamp("valid_until", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("coupons_code_key").on(table.code),
	pgPolicy("coupons_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"], using: sql`is_superadmin()`, withCheck: sql`is_superadmin()`  }),
	check("coupons_code_check", sql`(code = upper(code)) AND (code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'::text)`),
	check("coupons_value_check", sql`((discount_type = 'percent'::discount_type) AND ((discount_value >= 1) AND (discount_value <= 100))) OR ((discount_type = 'fixed'::discount_type) AND (discount_value > 0))`),
	check("coupons_currency_check", sql`(currency IS NULL) OR (currency = ANY (ARRAY['BRL'::text, 'USD'::text]))`),
	check("coupons_fixed_currency", sql`(discount_type <> 'fixed'::discount_type) OR (currency IS NOT NULL)`),
	check("coupons_duration_months", sql`((duration = 'repeating'::coupon_duration) AND (duration_months IS NOT NULL) AND (duration_months > 0)) OR ((duration <> 'repeating'::coupon_duration) AND (duration_months IS NULL))`),
	check("coupons_redemptions_check", sql`(max_redemptions IS NULL) OR (max_redemptions > 0)`),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	planId: uuid("plan_id").notNull(),
	status: subscriptionStatus().default('incomplete').notNull(),
	adminSuspended: boolean("admin_suspended").default(false).notNull(),
	provider: billingProvider(),
	providerCustomerId: text("provider_customer_id"),
	providerSubscriptionId: text("provider_subscription_id"),
	providerPaymentId: text("provider_payment_id"),
	renews: boolean().default(true).notNull(),
	period: billingPeriod(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	couponId: uuid("coupon_id"),
	priceCents: integer("price_cents"),
	currency: text(),
	couponCodeSnapshot: text("coupon_code_snapshot"),
	paymentMethod: text("payment_method"),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true, mode: 'string' }),
	cancelReason: subscriptionCancelReason("cancel_reason"),
	cancelNote: text("cancel_note"),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	pastDueSince: timestamp("past_due_since", { withTimezone: true, mode: 'string' }),
	provisionalUntil: timestamp("provisional_until", { withTimezone: true, mode: 'string' }),
	billingOperationId: uuid("billing_operation_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	termNoticeSentAt: timestamp("term_notice_sent_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("subscriptions_billing_operation_unique_idx").using("btree", table.billingOperationId.asc().nullsLast().op("uuid_ops")).where(sql`(billing_operation_id IS NOT NULL)`),
	index("subscriptions_cancellation_due_idx").using("btree", table.currentPeriodEnd.asc().nullsLast().op("timestamptz_ops")).where(sql`((cancel_at_period_end = true) AND (status = ANY (ARRAY['trialing'::subscription_status, 'active'::subscription_status, 'past_due'::subscription_status])))`),
	index("subscriptions_org_idx").using("btree", table.orgId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	uniqueIndex("subscriptions_org_live_unique").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")).where(sql`(status = ANY (ARRAY['trialing'::subscription_status, 'active'::subscription_status, 'past_due'::subscription_status]))`),
	uniqueIndex("subscriptions_provider_payment_unique_idx").using("btree", table.provider.asc().nullsLast().op("enum_ops"), table.providerPaymentId.asc().nullsLast().op("text_ops")).where(sql`((provider IS NOT NULL) AND (provider_payment_id IS NOT NULL))`),
	uniqueIndex("subscriptions_provider_subscription_unique_idx").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerSubscriptionId.asc().nullsLast().op("enum_ops")).where(sql`((provider IS NOT NULL) AND (provider_subscription_id IS NOT NULL))`),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "subscriptions_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "subscriptions_plan_id_fkey"
		}),
	foreignKey({
			columns: [table.couponId],
			foreignColumns: [coupons.id],
			name: "subscriptions_coupon_id_fkey"
		}).onDelete("set null"),
	// subscriptions_billing_operation_id_fkey: declared in SQL only (a TypeScript inference cycle with billing_operations).
	pgPolicy("subscriptions_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_org_member(org_id) OR is_superadmin())` }),
	pgPolicy("subscriptions_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("subscriptions_payment_method_check", sql`(payment_method IS NULL) OR (payment_method = ANY (ARRAY['pix'::text, 'credit_card'::text]))`),
	check("subscriptions_currency_check", sql`(currency IS NULL) OR (currency = ANY (ARRAY['BRL'::text, 'USD'::text]))`),
	check("subscriptions_price_check", sql`(price_cents IS NULL) OR (price_cents >= 0)`),
	check("subscriptions_cancel_note_length", sql`(cancel_note IS NULL) OR (char_length(cancel_note) <= 500)`),
]);

export const subscriptionModules = pgTable("subscription_modules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	moduleId: uuid("module_id").notNull(),
	status: text().default('active').notNull(),
	providerItemId: text("provider_item_id"),
	addedAt: timestamp("added_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "subscription_modules_subscription_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [modules.id],
			name: "subscription_modules_module_id_fkey"
		}),
	unique("subscription_modules_subscription_id_module_id_key").on(table.subscriptionId, table.moduleId),
	pgPolicy("subscription_modules_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_modules.subscription_id) AND (is_org_member(s.org_id) OR is_superadmin()))))` }),
	pgPolicy("subscription_modules_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("subscription_modules_status_check", sql`status = ANY (ARRAY['active'::text, 'canceled'::text])`),
]);

export const invoices = pgTable("invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	subscriptionId: uuid("subscription_id"),
	planId: uuid("plan_id"),
	provider: billingProvider().notNull(),
	providerInvoiceId: text("provider_invoice_id").notNull(),
	amountCents: integer("amount_cents").notNull(),
	currency: text().default('BRL').notNull(),
	status: invoiceStatus().default('open').notNull(),
	description: text(),
	invoiceUrl: text("invoice_url"),
	fiscalDocumentUrl: text("fiscal_document_url"),
	dueAt: timestamp("due_at", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invoices_org_idx").using("btree", table.orgId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	index("invoices_paid_idx").using("btree", table.paidAt.asc().nullsLast().op("timestamptz_ops")).where(sql`(status = 'paid'::invoice_status)`),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "invoices_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "invoices_subscription_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "invoices_plan_id_fkey"
		}).onDelete("set null"),
	unique("invoices_provider_provider_invoice_id_key").on(table.provider, table.providerInvoiceId),
	pgPolicy("invoices_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"], using: sql`is_superadmin()`, withCheck: sql`is_superadmin()`  }),
	pgPolicy("invoices_select_member", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("invoices_currency_check", sql`currency = ANY (ARRAY['BRL'::text, 'USD'::text])`),
]);

export const entitlementGrants = pgTable("entitlement_grants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	kind: text().notNull(),
	planId: uuid("plan_id"),
	limits: jsonb().default({}).notNull(),
	priceCents: integer("price_cents").default(0).notNull(),
	currency: text(),
	invoiceKey: text("invoice_key"),
	source: text().default('purchase').notNull(),
	grantedBy: uuid("granted_by"),
	note: text(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokeReason: text("revoke_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	endNoticeSentAt: timestamp("end_notice_sent_at", { withTimezone: true, mode: 'string' }),
	endedHandledAt: timestamp("ended_handled_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("entitlement_grants_live_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	index("entitlement_grants_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.grantedBy],
			foreignColumns: [profiles.id],
			name: "entitlement_grants_granted_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "entitlement_grants_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "entitlement_grants_plan_id_fkey"
		}).onDelete("set null"),
	unique("entitlement_grants_invoice_key_key").on(table.invoiceKey),
	pgPolicy("entitlement_grants_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_org_member(org_id) OR is_superadmin())` }),
	check("entitlement_grants_kind_check", sql`kind = ANY (ARRAY['kit'::text, 'license'::text, 'comp'::text])`),
	check("entitlement_grants_price_cents_check", sql`price_cents >= 0`),
	check("entitlement_grants_currency_check", sql`(currency IS NULL) OR (currency = ANY (ARRAY['BRL'::text, 'USD'::text]))`),
	check("entitlement_grants_source_check", sql`source = ANY (ARRAY['purchase'::text, 'admin'::text])`),
	check("entitlement_grants_purchase_key", sql`(source <> 'purchase'::text) OR (invoice_key IS NOT NULL)`),
	check("entitlement_grants_window", sql`(expires_at IS NULL) OR (expires_at > starts_at)`),
]);

export const billingOperations = pgTable("billing_operations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	actorId: uuid("actor_id").notNull(),
	kind: text().notNull(),
	idempotencyKey: uuid("idempotency_key").notNull(),
	planId: uuid("plan_id"),
	subscriptionId: uuid("subscription_id"),
	provider: text(),
	status: text().default('processing').notNull(),
	attempts: integer().default(1).notNull(),
	claimToken: uuid("claim_token"),
	result: jsonb().default({}).notNull(),
	errorCode: text("error_code"),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "billing_operations_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "billing_operations_actor_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [plans.id],
			name: "billing_operations_plan_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "billing_operations_subscription_id_fkey"
		}).onDelete("set null"),
	unique("billing_operations_org_id_kind_idempotency_key_key").on(table.orgId, table.kind, table.idempotencyKey),
	pgPolicy("billing_operations_select_manager", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((actor_id = auth.uid()) AND has_org_role(org_id, ARRAY['owner'::org_role, 'admin'::org_role]))` }),
	check("billing_operations_kind_check", sql`kind = ANY (ARRAY['checkout'::text, 'access_checkout'::text, 'cancel'::text, 'resume'::text])`),
	check("billing_operations_provider_check", sql`(provider IS NULL) OR (provider = ANY (ARRAY['stripe'::text, 'asaas'::text]))`),
	check("billing_operations_status_check", sql`status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])`),
	check("billing_operations_attempts_check", sql`attempts > 0`),
	check("billing_operations_processing_claim_check", sql`(status <> 'processing'::text) OR ((claim_token IS NOT NULL) AND (lease_expires_at IS NOT NULL))`),
]);

export const metaAttribution = pgTable("meta_attribution", {
	orgId: uuid("org_id").primaryKey().notNull(),
	fbp: text(),
	fbc: text(),
	gaClientId: text("ga_client_id"),
	email: text(),
	clientIp: text("client_ip"),
	clientUserAgent: text("client_user_agent"),
	campaignOrigem: text("campaign_origem"),
	campaignUtmSource: text("campaign_utm_source"),
	campaignUtmMedium: text("campaign_utm_medium"),
	campaignUtmCampaign: text("campaign_utm_campaign"),
	campaignUtmContent: text("campaign_utm_content"),
	campaignCapturedAt: timestamp("campaign_captured_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "meta_attribution_org_id_fkey"
		}).onDelete("cascade"),
	check("meta_attribution_campaign_lengths", sql`(COALESCE(length(campaign_origem), 0) <= 64) AND (COALESCE(length(campaign_utm_source), 0) <= 64) AND (COALESCE(length(campaign_utm_medium), 0) <= 64) AND (COALESCE(length(campaign_utm_campaign), 0) <= 64) AND (COALESCE(length(campaign_utm_content), 0) <= 64)`),
]);

export const billingWebhookEvents = pgTable("billing_webhook_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	provider: text().notNull(),
	providerEventId: text("provider_event_id").notNull(),
	eventType: text("event_type").notNull(),
	status: text().default('processing').notNull(),
	attempts: integer().default(1).notNull(),
	claimToken: uuid("claim_token"),
	leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true, mode: 'string' }),
	errorCode: text("error_code"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("billing_webhook_events_provider_provider_event_id_event_typ_key").on(table.provider, table.providerEventId, table.eventType),
	check("billing_webhook_events_provider_check", sql`provider = ANY (ARRAY['stripe'::text, 'asaas'::text])`),
	check("billing_webhook_events_status_check", sql`status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])`),
	check("billing_webhook_events_attempts_check", sql`attempts > 0`),
	check("billing_webhooks_processing_claim_check", sql`(status <> 'processing'::text) OR ((claim_token IS NOT NULL) AND (lease_expires_at IS NOT NULL))`),
]);

export const signupAttribution = pgTable("signup_attribution", {
	orgId: uuid("org_id").primaryKey().notNull(),
	origem: text(),
	onda: text(),
	utmSource: text("utm_source"),
	utmMedium: text("utm_medium"),
	utmCampaign: text("utm_campaign"),
	utmContent: text("utm_content"),
	utmTerm: text("utm_term"),
	referrer: text(),
	landingPath: text("landing_path"),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("signup_attribution_onda_idx").using("btree", table.onda.asc().nullsLast().op("timestamptz_ops"), table.capturedAt.desc().nullsFirst().op("text_ops")),
	index("signup_attribution_origem_idx").using("btree", table.origem.asc().nullsLast().op("timestamptz_ops"), table.capturedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "signup_attribution_org_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("signup_attribution_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("signup_attribution_lengths", sql`(COALESCE(length(origem), 0) <= 64) AND (COALESCE(length(onda), 0) <= 64) AND (COALESCE(length(utm_source), 0) <= 64) AND (COALESCE(length(utm_medium), 0) <= 64) AND (COALESCE(length(utm_campaign), 0) <= 64) AND (COALESCE(length(utm_content), 0) <= 64) AND (COALESCE(length(utm_term), 0) <= 64) AND (COALESCE(length(referrer), 0) <= 255) AND (COALESCE(length(landing_path), 0) <= 255)`),
]);

export const purchaseAttributions = pgTable("purchase_attributions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	invoiceKey: text("invoice_key").notNull(),
	subscriptionId: uuid("subscription_id"),
	planSlug: text("plan_slug"),
	amountCents: integer("amount_cents").notNull(),
	currency: text().notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }).notNull(),
	origem: text(),
	utmSource: text("utm_source"),
	utmMedium: text("utm_medium"),
	utmCampaign: text("utm_campaign"),
	utmContent: text("utm_content"),
	campaignCapturedAt: timestamp("campaign_captured_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("purchase_attributions_campaign_idx").using("btree", table.utmCampaign.asc().nullsLast().op("text_ops"), table.paidAt.desc().nullsFirst().op("text_ops")),
	index("purchase_attributions_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	index("purchase_attributions_origem_idx").using("btree", table.origem.asc().nullsLast().op("text_ops"), table.paidAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "purchase_attributions_org_id_fkey"
		}).onDelete("cascade"),
	unique("purchase_attributions_invoice_key_key").on(table.invoiceKey),
	pgPolicy("purchase_attributions_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("purchase_attributions_invoice_key_check", sql`char_length(invoice_key) <= 200`),
	check("purchase_attributions_plan_slug_check", sql`(plan_slug IS NULL) OR (char_length(plan_slug) <= 80)`),
	check("purchase_attributions_amount_cents_check", sql`amount_cents >= 0`),
	check("purchase_attributions_currency_check", sql`currency = ANY (ARRAY['BRL'::text, 'USD'::text])`),
	check("purchase_attributions_lengths", sql`(COALESCE(length(origem), 0) <= 64) AND (COALESCE(length(utm_source), 0) <= 64) AND (COALESCE(length(utm_medium), 0) <= 64) AND (COALESCE(length(utm_campaign), 0) <= 64) AND (COALESCE(length(utm_content), 0) <= 64)`),
]);

export const productEvents = pgTable("product_events", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "product_events_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	orgId: uuid("org_id"),
	actorId: uuid("actor_id"),
	eventName: text("event_name").notNull(),
	properties: jsonb().default({}).notNull(),
	segment: memberSegment(),
	locale: text(),
	aiTool: aiTool("ai_tool"),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("product_events_actor_idx").using("btree", table.actorId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("product_events_name_idx").using("btree", table.eventName.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")),
	index("product_events_occurred_idx").using("btree", table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	index("product_events_org_idx").using("btree", table.orgId.asc().nullsLast().op("timestamptz_ops"), table.eventName.asc().nullsLast().op("timestamptz_ops"), table.occurredAt.desc().nullsFirst().op("uuid_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "product_events_org_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "product_events_actor_id_fkey"
		}).onDelete("set null"),
	pgPolicy("product_events_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("product_events_name_check", sql`CHECK (product_event_known(event_name`),
	check("product_events_properties_size_check", sql`octet_length((properties)::text) <= 2048`),
	check("product_events_locale_check", sql`(locale IS NULL) OR (locale = ANY (ARRAY['pt-BR'::text, 'en'::text]))`),
]);

export const helpCategories = pgTable("help_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	locale: text().default('pt-BR').notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text(),
	translationGroup: uuid("translation_group").defaultRandom().notNull(),
	sort: integer().default(0).notNull(),
	isPublished: boolean("is_published").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("help_categories_locale_slug_key").on(table.locale, table.slug),
	unique("help_categories_translation_group_locale_key").on(table.locale, table.translationGroup),
	pgPolicy("help_categories_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`is_published` }),
	pgPolicy("help_categories_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("help_categories_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
]);

export const helpArticles = pgTable("help_articles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	categoryId: uuid("category_id").notNull(),
	locale: text().default('pt-BR').notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	excerpt: text(),
	bodyMd: text("body_md").default('').notNull(),
	translationGroup: uuid("translation_group").defaultRandom().notNull(),
	sort: integer().default(0).notNull(),
	isPublished: boolean("is_published").default(false).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("help_articles_category_idx").using("btree", table.categoryId.asc().nullsLast().op("uuid_ops")),
	index("help_articles_locale_idx").using("btree", table.locale.asc().nullsLast().op("text_ops")).where(sql`is_published`),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [helpCategories.id],
			name: "help_articles_category_id_fkey"
		}).onDelete("cascade"),
	unique("help_articles_locale_slug_key").on(table.locale, table.slug),
	unique("help_articles_translation_group_locale_key").on(table.locale, table.translationGroup),
	pgPolicy("help_articles_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`is_published` }),
	pgPolicy("help_articles_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("help_articles_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
]);

export const blogPosts = pgTable("blog_posts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	locale: text().default('pt-BR').notNull(),
	slug: text().notNull(),
	title: text().notNull(),
	excerpt: text(),
	bodyMd: text("body_md").default('').notNull(),
	coverUrl: text("cover_url"),
	authorName: text("author_name"),
	tags: text().array().default(sql`'{}'`).notNull(),
	kind: text().default('post').notNull(),
	audience: text().default('public').notNull(),
	translationGroup: uuid("translation_group").defaultRandom().notNull(),
	isPublished: boolean("is_published").default(false).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("blog_posts_kind_idx").using("btree", table.kind.asc().nullsLast().op("text_ops"), table.locale.asc().nullsLast().op("timestamptz_ops"), table.publishedAt.desc().nullsFirst().op("timestamptz_ops")).where(sql`is_published`),
	index("blog_posts_locale_idx").using("btree", table.locale.asc().nullsLast().op("timestamptz_ops"), table.publishedAt.desc().nullsFirst().op("text_ops")).where(sql`is_published`),
	unique("blog_posts_locale_slug_key").on(table.locale, table.slug),
	unique("blog_posts_translation_group_locale_key").on(table.locale, table.translationGroup),
	pgPolicy("blog_posts_select_public", { as: "permissive", for: "select", to: ["anon"], using: sql`(is_published AND (audience = 'public'::text))` }),
	pgPolicy("blog_posts_select_member", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("blog_posts_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("blog_posts_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("blog_posts_kind_check", sql`kind = ANY (ARRAY['post'::text, 'news'::text])`),
	check("blog_posts_audience_check", sql`audience = ANY (ARRAY['public'::text, 'members'::text])`),
]);

export const catalogTrails = pgTable("catalog_trails", {
	slug: text().primaryKey().notNull(),
	name: jsonb().notNull(),
	description: jsonb().default({}).notNull(),
	icon: text(),
	sort: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("catalog_trails_select", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
	pgPolicy("catalog_trails_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_trails_description_check", sql`CHECK (i18n_ok(description`),
	check("catalog_trails_slug_check", sql`slug ~ '^[a-z][a-z0-9-]{1,29}$'::text`),
	check("catalog_trails_name_check", sql`CHECK (i18n_ok(name, true`),
]);

export const blogComments = pgTable("blog_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull(),
	userId: uuid("user_id").notNull(),
	authorName: text("author_name"),
	body: text().notNull(),
	status: blogCommentStatus().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("blog_comments_post_idx").using("btree", table.postId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [blogPosts.id],
			name: "blog_comments_post_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "blog_comments_user_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("blog_comments_select_public", { as: "permissive", for: "select", to: ["anon"], using: sql`((status = 'approved'::blog_comment_status) AND (EXISTS ( SELECT 1
   FROM blog_posts p
  WHERE ((p.id = blog_comments.post_id) AND p.is_published AND (p.audience = 'public'::text)))))` }),
	pgPolicy("blog_comments_select_member", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("blog_comments_insert_own", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("blog_comments_delete_own", { as: "permissive", for: "delete", to: ["authenticated"] }),
	pgPolicy("blog_comments_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("blog_comments_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 4000)`),
]);

export const catalogModules = pgTable("catalog_modules", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	trail: text().notNull(),
	type: text().notNull(),
	icon: text(),
	name: jsonb().notNull(),
	summary: jsonb().default({}).notNull(),
	descriptionMd: jsonb("description_md").default({}).notNull(),
	compatibleAis: aiTool("compatible_ais").array().default(sql`'{}'`).notNull(),
	externalCredentials: jsonb("external_credentials").default([]).notNull(),
	status: text().default('draft').notNull(),
	isFreeSample: boolean("is_free_sample").default(false).notNull(),
	entitlementKey: text("entitlement_key").default('catalog_access').notNull(),
	sort: integer().default(0).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	storeCategory: text("store_category"),
}, (table) => [
	index("catalog_modules_store_category_idx").using("btree", table.storeCategory.asc().nullsLast().op("text_ops")).where(sql`(store_category IS NOT NULL)`),
	index("catalog_modules_trail_idx").using("btree", table.trail.asc().nullsLast().op("text_ops"), table.sort.asc().nullsLast().op("text_ops")).where(sql`(status = 'published'::text)`),
	foreignKey({
			columns: [table.trail],
			foreignColumns: [catalogTrails.slug],
			name: "catalog_modules_trail_fkey"
		}).onUpdate("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "catalog_modules_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.storeCategory],
			foreignColumns: [catalogStoreCategories.slug],
			name: "catalog_modules_store_category_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	unique("catalog_modules_slug_key").on(table.slug),
	pgPolicy("catalog_modules_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`(status = 'published'::text)` }),
	pgPolicy("catalog_modules_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_modules_slug_check", sql`slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'::text`),
	check("catalog_modules_type_check", sql`type = ANY (ARRAY['skill'::text, 'workflow'::text, 'framework'::text, 'tool'::text])`),
	check("catalog_modules_name_check", sql`CHECK (i18n_ok(name, true`),
	check("catalog_modules_summary_check", sql`CHECK (i18n_ok(summary`),
	check("catalog_modules_description_md_check", sql`CHECK (i18n_ok(description_md`),
	check("catalog_modules_external_credentials_check", sql`jsonb_typeof(external_credentials) = 'array'::text`),
	check("catalog_modules_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])`),
	check("catalog_modules_entitlement_key_check", sql`entitlement_key ~ '^[a-z][a-z0-9_]{1,39}$'::text`),
]);

export const catalogModuleVersions = pgTable("catalog_module_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	moduleId: uuid("module_id").notNull(),
	version: text().notNull(),
	isStable: boolean("is_stable").default(false).notNull(),
	status: text().default('draft').notNull(),
	storagePath: text("storage_path").notNull(),
	sha256: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
	manifest: jsonb().default({}).notNull(),
	changelog: jsonb().default({}).notNull(),
	minCoreVersion: text("min_core_version"),
	compatibleAis: aiTool("compatible_ais").array().default(sql`'{}'`).notNull(),
	permissions: jsonb().default([]).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	yankedAt: timestamp("yanked_at", { withTimezone: true, mode: 'string' }),
	yankReason: text("yank_reason"),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("catalog_module_versions_module_idx").using("btree", table.moduleId.asc().nullsLast().op("uuid_ops"), table.publishedAt.desc().nullsFirst().op("uuid_ops")).where(sql`(status = 'published'::text)`),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [catalogModules.id],
			name: "catalog_module_versions_module_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "catalog_module_versions_created_by_fkey"
		}).onDelete("set null"),
	unique("catalog_module_versions_module_id_version_key").on(table.moduleId, table.version),
	pgPolicy("catalog_module_versions_select_released", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`((status = ANY (ARRAY['published'::text, 'yanked'::text])) AND (EXISTS ( SELECT 1
   FROM catalog_modules m
  WHERE ((m.id = catalog_module_versions.module_id) AND (m.status = 'published'::text)))))` }),
	pgPolicy("catalog_module_versions_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_module_versions_version_check", sql`CHECK (semver_ok(version`),
	check("catalog_module_versions_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text, 'yanked'::text])`),
	check("catalog_module_versions_sha256_check", sql`sha256 ~ '^[0-9a-f]{64}$'::text`),
	check("catalog_module_versions_size_bytes_check", sql`size_bytes > 0`),
	check("catalog_module_versions_manifest_check", sql`jsonb_typeof(manifest) = 'object'::text`),
	check("catalog_module_versions_changelog_check", sql`CHECK (i18n_ok(changelog`),
	check("catalog_module_versions_min_core_version_check", sql`(min_core_version IS NULL) OR semver_ok(min_core_version)`),
	check("catalog_module_versions_permissions_check", sql`jsonb_typeof(permissions) = 'array'::text`),
	check("catalog_module_versions_yank_reason", sql`(status <> 'yanked'::text) OR (NULLIF(btrim(yank_reason), ''::text) IS NOT NULL)`),
]);

export const catalogLessons = pgTable("catalog_lessons", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	moduleId: uuid("module_id").notNull(),
	depth: text().notNull(),
	locale: text().notNull(),
	title: text().notNull(),
	videoProvider: text("video_provider").default('youtube').notNull(),
	durationSeconds: integer("duration_seconds"),
	isAdvanced: boolean("is_advanced").default(false).notNull(),
	sort: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [catalogModules.id],
			name: "catalog_lessons_module_id_fkey"
		}).onDelete("cascade"),
	unique("catalog_lessons_module_id_depth_locale_key").on(table.moduleId, table.depth, table.locale),
	pgPolicy("catalog_lessons_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM catalog_modules m
  WHERE ((m.id = catalog_lessons.module_id) AND (m.status = 'published'::text))))` }),
	pgPolicy("catalog_lessons_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_lessons_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("catalog_lessons_depth_check", sql`depth = ANY (ARRAY['usar'::text, 'abrir_o_capo'::text])`),
	check("catalog_lessons_title_check", sql`(char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 160)`),
	check("catalog_lessons_video_provider_check", sql`video_provider = 'youtube'::text`),
	check("catalog_lessons_duration_seconds_check", sql`(duration_seconds IS NULL) OR (duration_seconds > 0)`),
]);

export const catalogLessonVideos = pgTable("catalog_lesson_videos", {
	lessonId: uuid("lesson_id").primaryKey().notNull(),
	youtubeId: text("youtube_id").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [catalogLessons.id],
			name: "catalog_lesson_videos_lesson_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("catalog_lesson_videos_select_entitled", { as: "permissive", for: "select", to: ["authenticated"], using: sql`can_watch_lesson(lesson_id)` }),
	pgPolicy("catalog_lesson_videos_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_lesson_videos_youtube_id_check", sql`youtube_id ~ '^[A-Za-z0-9_-]{6,20}$'::text`),
]);

export const catalogRecipes = pgTable("catalog_recipes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: jsonb().notNull(),
	summary: jsonb().default({}).notNull(),
	icon: text(),
	status: text().default('draft').notNull(),
	sort: integer().default(0).notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("catalog_recipes_slug_key").on(table.slug),
	pgPolicy("catalog_recipes_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`(status = 'published'::text)` }),
	pgPolicy("catalog_recipes_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_recipes_slug_check", sql`slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'::text`),
	check("catalog_recipes_name_check", sql`CHECK (i18n_ok(name, true`),
	check("catalog_recipes_summary_check", sql`CHECK (i18n_ok(summary`),
	check("catalog_recipes_status_check", sql`status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])`),
]);

export const catalogRecipeWorkflows = pgTable("catalog_recipe_workflows", {
	recipeId: uuid("recipe_id").primaryKey().notNull(),
	bodyMd: jsonb("body_md").default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.recipeId],
			foreignColumns: [catalogRecipes.id],
			name: "catalog_recipe_workflows_recipe_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("catalog_recipe_workflows_select_entitled", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((EXISTS ( SELECT 1
   FROM catalog_recipes r
  WHERE ((r.id = catalog_recipe_workflows.recipe_id) AND (r.status = 'published'::text)))) AND ( SELECT org_has_entitlement(current_org_id(), 'recipes'::text) AS org_has_entitlement))` }),
	pgPolicy("catalog_recipe_workflows_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_recipe_workflows_body_md_check", sql`CHECK (i18n_ok(body_md`),
]);

export const oauthClients = pgTable("oauth_clients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: text("client_id").notNull(),
	clientName: text("client_name").notNull(),
	redirectUris: text("redirect_uris").array().notNull(),
	tokenEndpointAuthMethod: text("token_endpoint_auth_method").default('none').notNull(),
	clientSecretHash: text("client_secret_hash"),
	clientUri: text("client_uri"),
	logoUri: text("logo_uri"),
	firstParty: boolean("first_party").default(false).notNull(),
	loopbackAnyPort: boolean("loopback_any_port").default(false).notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("oauth_clients_client_id_key").on(table.clientId),
	pgPolicy("oauth_clients_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("oauth_clients_token_endpoint_auth_method_check", sql`token_endpoint_auth_method = ANY (ARRAY['none'::text, 'client_secret_post'::text, 'client_secret_basic'::text])`),
]);

export const roadmapItems = pgTable("roadmap_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: jsonb().notNull(),
	description: jsonb().default({}).notNull(),
	trail: text(),
	status: text().default('proposed').notNull(),
	votesCount: integer("votes_count").default(0).notNull(),
	shippedModuleId: uuid("shipped_module_id"),
	sort: integer().default(0).notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	proposedBy: uuid("proposed_by"),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("roadmap_items_proposed_by_idx").using("btree", table.proposedBy.asc().nullsLast().op("uuid_ops")).where(sql`(proposed_by IS NOT NULL)`),
	index("roadmap_items_status_idx").using("btree", table.status.asc().nullsLast().op("int4_ops"), table.votesCount.desc().nullsFirst().op("int4_ops")),
	foreignKey({
			columns: [table.trail],
			foreignColumns: [catalogTrails.slug],
			name: "roadmap_items_trail_fkey"
		}).onUpdate("cascade"),
	foreignKey({
			columns: [table.shippedModuleId],
			foreignColumns: [catalogModules.id],
			name: "roadmap_items_shipped_module_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "roadmap_items_created_by_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.proposedBy],
			foreignColumns: [profiles.id],
			name: "roadmap_items_proposed_by_fkey"
		}).onDelete("set null"),
	pgPolicy("roadmap_items_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"], using: sql`is_superadmin()`, withCheck: sql`is_superadmin()`  }),
	pgPolicy("roadmap_items_select_member", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("roadmap_items_title_check", sql`CHECK (i18n_ok(title, true`),
	check("roadmap_items_description_check", sql`CHECK (i18n_ok(description`),
	check("roadmap_items_votes_count_check", sql`votes_count >= 0`),
	check("roadmap_items_status_check", sql`status = ANY (ARRAY['submitted'::text, 'proposed'::text, 'planned'::text, 'building'::text, 'shipped'::text, 'declined'::text])`),
]);

export const oauthGrants = pgTable("oauth_grants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	codeHash: text("code_hash").notNull(),
	codeChallenge: text("code_challenge").notNull(),
	codeChallengeMethod: text("code_challenge_method").default('S256').notNull(),
	redirectUri: text("redirect_uri").notNull(),
	scope: text().notNull(),
	deviceId: text("device_id"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClients.id],
			name: "oauth_grants_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "oauth_grants_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "oauth_grants_user_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_grants_code_hash_key").on(table.codeHash),
	check("oauth_grants_code_challenge_method_check", sql`code_challenge_method = 'S256'::text`),
]);

export const oauthTokens = pgTable("oauth_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	accessTokenHash: text("access_token_hash").notNull(),
	refreshTokenHash: text("refresh_token_hash"),
	scope: text().notNull(),
	familyId: uuid("family_id").defaultRandom().notNull(),
	deviceId: text("device_id"),
	accessExpiresAt: timestamp("access_expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_tokens_device_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.deviceId.asc().nullsLast().op("text_ops")).where(sql`(device_id IS NOT NULL)`),
	index("oauth_tokens_family_idx").using("btree", table.familyId.asc().nullsLast().op("uuid_ops")),
	index("oauth_tokens_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("oauth_tokens_refresh_due_idx").using("btree", table.refreshExpiresAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((revoked_at IS NULL) AND (refresh_expires_at IS NOT NULL))`),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClients.id],
			name: "oauth_tokens_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "oauth_tokens_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "oauth_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_tokens_access_token_hash_key").on(table.accessTokenHash),
	unique("oauth_tokens_refresh_token_hash_key").on(table.refreshTokenHash),
	pgPolicy("oauth_tokens_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_org_member(org_id) OR is_superadmin())` }),
]);

export const oauthDeviceCodes = pgTable("oauth_device_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clientId: uuid("client_id").notNull(),
	deviceCodeHash: text("device_code_hash").notNull(),
	userCode: text("user_code").notNull(),
	scope: text().notNull(),
	deviceId: text("device_id"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	intervalSeconds: integer("interval_seconds").default(5).notNull(),
	lastPolledAt: timestamp("last_polled_at", { withTimezone: true, mode: 'string' }),
	status: text().default('pending').notNull(),
	userId: uuid("user_id"),
	orgId: uuid("org_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("oauth_device_codes_expiry_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [oauthClients.id],
			name: "oauth_device_codes_client_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "oauth_device_codes_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "oauth_device_codes_org_id_fkey"
		}).onDelete("cascade"),
	unique("oauth_device_codes_device_code_hash_key").on(table.deviceCodeHash),
	unique("oauth_device_codes_user_code_key").on(table.userCode),
	check("oauth_device_codes_user_code_check", sql`user_code ~ '^[A-HJ-NP-Z2-9]{8}$'::text`),
	check("oauth_device_codes_interval_seconds_check", sql`(interval_seconds >= 1) AND (interval_seconds <= 60)`),
	check("oauth_device_codes_status_check", sql`status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text, 'consumed'::text])`),
	check("oauth_device_codes_approval", sql`(status <> ALL (ARRAY['approved'::text, 'consumed'::text])) OR ((user_id IS NOT NULL) AND (org_id IS NOT NULL))`),
]);

export const memberDevices = pgTable("member_devices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id").notNull(),
	deviceId: text("device_id").notNull(),
	name: text(),
	os: text(),
	osVersion: text("os_version"),
	aiTool: aiTool("ai_tool"),
	cliVersion: text("cli_version"),
	coreVersion: text("core_version"),
	installedModules: jsonb("installed_modules").default([]).notNull(),
	projectKind: text("project_kind"),
	tokenFamilyId: uuid("token_family_id"),
	firstSeenAt: timestamp("first_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastUpdateAt: timestamp("last_update_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	revokeReason: text("revoke_reason"),
}, (table) => [
	index("member_devices_family_idx").using("btree", table.tokenFamilyId.asc().nullsLast().op("uuid_ops")).where(sql`(token_family_id IS NOT NULL)`),
	index("member_devices_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")).where(sql`(revoked_at IS NULL)`),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "member_devices_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "member_devices_user_id_fkey"
		}).onDelete("cascade"),
	unique("member_devices_user_id_device_id_key").on(table.userId, table.deviceId),
	pgPolicy("member_devices_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(is_org_member(org_id) OR is_superadmin())` }),
	check("member_devices_installed_modules_check", sql`jsonb_typeof(installed_modules) = 'array'::text`),
	check("member_devices_device_id_check", sql`device_id ~ '^[A-Za-z0-9_-]{8,64}$'::text`),
	check("member_devices_name_check", sql`(name IS NULL) OR (char_length(name) <= 80)`),
	check("member_devices_os_check", sql`(os IS NULL) OR (os = ANY (ARRAY['windows'::text, 'macos'::text, 'linux'::text, 'other'::text]))`),
	check("member_devices_os_version_check", sql`(os_version IS NULL) OR (char_length(os_version) <= 40)`),
	check("member_devices_cli_version_check", sql`(cli_version IS NULL) OR semver_ok(cli_version)`),
	check("member_devices_core_version_check", sql`(core_version IS NULL) OR semver_ok(core_version)`),
	check("member_devices_project_kind_check", sql`(project_kind IS NULL) OR (project_kind = ANY (ARRAY['own'::text, 'client'::text]))`),
]);

export const cliRequests = pgTable("cli_requests", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "cli_requests_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	orgId: uuid("org_id").notNull(),
	tokenId: uuid("token_id"),
	deviceId: text("device_id"),
	endpoint: text().notNull(),
	status: text().default('ok').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cli_requests_window_idx").using("btree", table.orgId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "cli_requests_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tokenId],
			foreignColumns: [oauthTokens.id],
			name: "cli_requests_token_id_fkey"
		}).onDelete("set null"),
	pgPolicy("cli_requests_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("cli_requests_endpoint_check", sql`char_length(endpoint) <= 60`),
	check("cli_requests_status_check", sql`status = ANY (ARRAY['ok'::text, 'denied_scope'::text, 'denied_entitlement'::text, 'denied_device'::text, 'denied_rate'::text, 'error'::text])`),
]);

export const leads = pgTable("leads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// TODO: failed to parse database type 'citext'
	email: citext("email").notNull(),
	name: text(),
	phone: text(),
	locale: text().default('pt-BR').notNull(),
	segment: memberSegment(),
	source: text().default('waitlist').notNull(),
	origem: text(),
	onda: text(),
	cupom: text(),
	utmSource: text("utm_source"),
	utmMedium: text("utm_medium"),
	utmCampaign: text("utm_campaign"),
	utmContent: text("utm_content"),
	utmTerm: text("utm_term"),
	referrer: text(),
	landingPath: text("landing_path"),
	consentTermId: uuid("consent_term_id"),
	consentTermVersion: integer("consent_term_version"),
	consentText: text("consent_text"),
	consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true, mode: 'string' }),
	confirmTokenHash: text("confirm_token_hash"),
	confirmSentAt: timestamp("confirm_sent_at", { withTimezone: true, mode: 'string' }),
	confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: 'string' }),
	emailUnsubscribeToken: uuid("email_unsubscribe_token").defaultRandom().notNull(),
	optedOutAt: timestamp("opted_out_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("leads_confirmed_idx").using("btree", table.confirmedAt.asc().nullsLast().op("timestamptz_ops")).where(sql`((confirmed_at IS NOT NULL) AND (opted_out_at IS NULL))`),
	index("leads_created_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("leads_origem_idx").using("btree", table.origem.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.consentTermId],
			foreignColumns: [consentTerms.id],
			name: "leads_consent_term_id_fkey"
		}),
	unique("leads_email_key").on(table.email),
	unique("leads_confirm_token_hash_key").on(table.confirmTokenHash),
	unique("leads_email_unsubscribe_token_key").on(table.emailUnsubscribeToken),
	pgPolicy("leads_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	pgPolicy("leads_update_superadmin", { as: "permissive", for: "update", to: ["authenticated"] }),
	check("leads_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("leads_source_check", sql`source = ANY (ARRAY['waitlist'::text, 'newsletter'::text, 'contact'::text, 'meeting'::text])`),
	check("leads_email_check", sql`(char_length((email)::text) <= 254) AND ((email)::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)`),
	check("leads_name_check", sql`(name IS NULL) OR ((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120))`),
	check("leads_phone_check", sql`(phone IS NULL) OR (phone ~ '^[1-9][0-9]{7,14}$'::text)`),
	check("leads_token_hash_check", sql`(confirm_token_hash IS NULL) OR (confirm_token_hash ~ '^[0-9a-f]{64}$'::text)`),
	check("leads_lengths", sql`(COALESCE(length(origem), 0) <= 64) AND (COALESCE(length(onda), 0) <= 64) AND (COALESCE(length(cupom), 0) <= 64) AND (COALESCE(length(utm_source), 0) <= 64) AND (COALESCE(length(utm_medium), 0) <= 64) AND (COALESCE(length(utm_campaign), 0) <= 64) AND (COALESCE(length(utm_content), 0) <= 64) AND (COALESCE(length(utm_term), 0) <= 64) AND (COALESCE(length(referrer), 0) <= 255) AND (COALESCE(length(landing_path), 0) <= 255)`),
	check("leads_consent_whole", sql`((consent_term_id IS NULL) AND (consent_term_version IS NULL) AND (consent_text IS NULL) AND (consent_accepted_at IS NULL)) OR ((consent_term_id IS NOT NULL) AND (consent_term_version IS NOT NULL) AND (consent_text IS NOT NULL) AND (consent_accepted_at IS NOT NULL))`),
]);

export const moduleDownloads = pgTable("module_downloads", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "module_downloads_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	orgId: uuid("org_id").notNull(),
	userId: uuid("user_id"),
	deviceId: text("device_id"),
	moduleId: uuid("module_id").notNull(),
	versionId: uuid("version_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("module_downloads_org_idx").using("btree", table.orgId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	index("module_downloads_version_idx").using("btree", table.versionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "module_downloads_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "module_downloads_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [catalogModules.id],
			name: "module_downloads_module_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.versionId],
			foreignColumns: [catalogModuleVersions.id],
			name: "module_downloads_version_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("module_downloads_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
]);

export const impersonationSessions = pgTable("impersonation_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorId: uuid("actor_id").notNull(),
	targetUserId: uuid("target_user_id").notNull(),
	targetOrgId: uuid("target_org_id"),
	reason: text().notNull(),
	sessionId: uuid("session_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	endedAt: timestamp("ended_at", { withTimezone: true, mode: 'string' }),
	endedReason: text("ended_reason"),
}, (table) => [
	index("impersonation_sessions_actor_idx").using("btree", table.actorId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("impersonation_sessions_target_idx").using("btree", table.targetUserId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.targetOrgId],
			foreignColumns: [organizations.id],
			name: "impersonation_sessions_target_org_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "impersonation_sessions_actor_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.targetUserId],
			foreignColumns: [profiles.id],
			name: "impersonation_sessions_target_user_id_fkey"
		}).onDelete("cascade"),
	unique("impersonation_sessions_session_id_key").on(table.sessionId),
	pgPolicy("impersonation_sessions_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(target_user_id = auth.uid())` }),
	pgPolicy("impersonation_sessions_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
	check("impersonation_sessions_reason_check", sql`length(btrim(reason)) >= 8`),
]);

export const leadSubmissions = pgTable("lead_submissions", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "lead_submissions_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	ipHash: text("ip_hash").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("lead_submissions_window_idx").using("btree", table.ipHash.asc().nullsLast().op("text_ops"), table.createdAt.desc().nullsFirst().op("text_ops")),
	check("lead_submissions_ip_hash_check", sql`ip_hash ~ '^[0-9a-f]{64}$'::text`),
]);

export const meetings = pgTable("meetings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	title: jsonb().notNull(),
	description: jsonb().default({}).notNull(),
	startsAt: timestamp("starts_at", { withTimezone: true, mode: 'string' }),
	durationMinutes: integer("duration_minutes"),
	state: text().default('rascunho').notNull(),
	provider: text().default('zoom').notNull(),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	updatedBy: uuid("updated_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("meetings_state_idx").using("btree", table.state.asc().nullsLast().op("text_ops"), table.startsAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.updatedBy],
			foreignColumns: [profiles.id],
			name: "meetings_updated_by_fkey"
		}).onDelete("set null"),
	unique("meetings_slug_key").on(table.slug),
	pgPolicy("meetings_select_member", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(state = ANY (ARRAY['inscricoes'::text, 'ao_vivo'::text, 'encerrado'::text]))` }),
	pgPolicy("meetings_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("meetings_slug_check", sql`slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'::text`),
	check("meetings_title_check", sql`CHECK (i18n_ok(title, true`),
	check("meetings_description_check", sql`CHECK (i18n_ok(description`),
	check("meetings_duration_minutes_check", sql`(duration_minutes IS NULL) OR ((duration_minutes >= 5) AND (duration_minutes <= 600))`),
	check("meetings_state_check", sql`state = ANY (ARRAY['rascunho'::text, 'inscricoes'::text, 'ao_vivo'::text, 'encerrado'::text, 'arquivado'::text])`),
	check("meetings_provider_check", sql`provider = ANY (ARRAY['zoom'::text, 'meet'::text, 'youtube'::text, 'outro'::text])`),
]);

export const meetingLinks = pgTable("meeting_links", {
	meetingId: uuid("meeting_id").primaryKey().notNull(),
	joinUrl: text("join_url"),
	recordingUrl: text("recording_url"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.meetingId],
			foreignColumns: [meetings.id],
			name: "meeting_links_meeting_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("meeting_links_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"], using: sql`is_superadmin()`, withCheck: sql`is_superadmin()`  }),
	check("meeting_links_join_url_check", sql`(join_url IS NULL) OR ((join_url ~ '^https://[^[:space:]]{4,}$'::text) AND (char_length(join_url) <= 500))`),
	check("meeting_links_recording_url_check", sql`(recording_url IS NULL) OR ((recording_url ~ '^https://[^[:space:]]{4,}$'::text) AND (char_length(recording_url) <= 500))`),
]);

export const meetingRegistrations = pgTable("meeting_registrations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	meetingId: uuid("meeting_id").notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }),
	confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true, mode: 'string' }),
	reminderDaySentAt: timestamp("reminder_day_sent_at", { withTimezone: true, mode: 'string' }),
	reminderHourSentAt: timestamp("reminder_hour_sent_at", { withTimezone: true, mode: 'string' }),
	recordingSentAt: timestamp("recording_sent_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("meeting_registrations_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	index("meeting_registrations_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.meetingId],
			foreignColumns: [meetings.id],
			name: "meeting_registrations_meeting_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "meeting_registrations_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "meeting_registrations_org_id_fkey"
		}).onDelete("cascade"),
	unique("meeting_registrations_meeting_id_user_id_key").on(table.meetingId, table.userId),
	pgPolicy("meeting_registrations_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("meeting_registrations_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const newsletterSends = pgTable("newsletter_sends", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subject: jsonb().notNull(),
	bodyMd: jsonb("body_md").notNull(),
	source: text(),
	status: text().default('queued').notNull(),
	delivered: integer().default(0).notNull(),
	lastError: text("last_error"),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [profiles.id],
			name: "newsletter_sends_created_by_fkey"
		}).onDelete("set null"),
	pgPolicy("newsletter_sends_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("newsletter_sends_subject_check", sql`CHECK (i18n_ok(subject`),
	check("newsletter_sends_body_md_check", sql`CHECK (i18n_ok(body_md`),
	check("newsletter_sends_source_check", sql`(source IS NULL) OR (source = ANY (ARRAY['waitlist'::text, 'newsletter'::text, 'contact'::text, 'meeting'::text]))`),
	check("newsletter_sends_status_check", sql`status = ANY (ARRAY['queued'::text, 'sending'::text, 'sent'::text, 'failed'::text])`),
	check("newsletter_sends_delivered_check", sql`delivered >= 0`),
	check("newsletter_sends_languages", sql`(subject <> '{}'::jsonb) AND (body_md <> '{}'::jsonb)`),
]);

export const aiSpend = pgTable("ai_spend", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orgId: uuid("org_id"),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	feature: text().notNull(),
	provider: text().notNull(),
	model: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tokensIn: bigint("tokens_in", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	tokensOut: bigint("tokens_out", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	costUsdMicros: bigint("cost_usd_micros", { mode: "number" }).default(0).notNull(),
	priced: boolean().default(false).notNull(),
	refId: uuid("ref_id"),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ai_spend_at_idx").using("btree", table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
	index("ai_spend_feature_idx").using("btree", table.feature.asc().nullsLast().op("text_ops"), table.occurredAt.desc().nullsFirst().op("text_ops")),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "ai_spend_org_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "ai_spend_created_by_fkey"
		}).onDelete("set null"),
	pgPolicy("ai_spend_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("ai_spend_cost_usd_micros_check", sql`cost_usd_micros >= 0`),
	check("ai_spend_tokens_out_check", sql`tokens_out >= 0`),
	check("ai_spend_feature_check", sql`feature = ANY (ARRAY['insights'::text, 'other'::text])`),
	check("ai_spend_tokens_in_check", sql`tokens_in >= 0`),
]);

export const catalogStoreCategories = pgTable("catalog_store_categories", {
	slug: text().primaryKey().notNull(),
	name: jsonb().notNull(),
	sort: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	pgPolicy("catalog_store_categories_select", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
	pgPolicy("catalog_store_categories_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
	check("catalog_store_categories_slug_check", sql`slug ~ '^[a-z][a-z0-9-]{1,30}$'::text`),
	check("catalog_store_categories_name_check", sql`CHECK (i18n_ok(name, true`),
]);

export const announcementDismissals = pgTable("announcement_dismissals", {
	announcementId: uuid("announcement_id").notNull(),
	userId: uuid("user_id").notNull(),
	dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.announcementId],
			foreignColumns: [announcements.id],
			name: "announcement_dismissals_announcement_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "announcement_dismissals_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.announcementId, table.userId], name: "announcement_dismissals_pkey"}),
	pgPolicy("announcement_dismissals_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("announcement_dismissals_insert_own", { as: "permissive", for: "insert", to: ["authenticated"] }),
]);

export const catalogRecipeModules = pgTable("catalog_recipe_modules", {
	recipeId: uuid("recipe_id").notNull(),
	moduleId: uuid("module_id").notNull(),
	sort: integer().default(0).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.recipeId],
			foreignColumns: [catalogRecipes.id],
			name: "catalog_recipe_modules_recipe_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [catalogModules.id],
			name: "catalog_recipe_modules_module_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.recipeId, table.moduleId], name: "catalog_recipe_modules_pkey"}),
	pgPolicy("catalog_recipe_modules_select_published", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`(EXISTS ( SELECT 1
   FROM catalog_recipes r
  WHERE ((r.id = catalog_recipe_modules.recipe_id) AND (r.status = 'published'::text))))` }),
	pgPolicy("catalog_recipe_modules_all_superadmin", { as: "permissive", for: "all", to: ["authenticated"] }),
]);

export const newsletterDeliveries = pgTable("newsletter_deliveries", {
	sendId: uuid("send_id").notNull(),
	leadId: uuid("lead_id").notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("newsletter_deliveries_lead_idx").using("btree", table.leadId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sendId],
			foreignColumns: [newsletterSends.id],
			name: "newsletter_deliveries_send_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [leads.id],
			name: "newsletter_deliveries_lead_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.sendId, table.leadId], name: "newsletter_deliveries_pkey"}),
]);

export const roadmapVotes = pgTable("roadmap_votes", {
	itemId: uuid("item_id").notNull(),
	userId: uuid("user_id").notNull(),
	orgId: uuid("org_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("roadmap_votes_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	index("roadmap_votes_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.itemId],
			foreignColumns: [roadmapItems.id],
			name: "roadmap_votes_item_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "roadmap_votes_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "roadmap_votes_org_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.itemId, table.userId], name: "roadmap_votes_pkey"}),
	pgPolicy("roadmap_votes_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("roadmap_votes_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const sitePageViews = pgTable("site_page_views", {
	day: date().notNull(),
	path: text().notNull(),
	origem: text().notNull(),
	locale: text().notNull(),
	views: integer().default(0).notNull(),
}, (table) => [
	primaryKey({ columns: [table.day, table.path, table.origem, table.locale], name: "site_page_views_pkey"}),
	pgPolicy("site_page_views_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
	check("site_page_views_locale_check", sql`locale = ANY (ARRAY['pt-BR'::text, 'en'::text])`),
	check("site_page_views_views_check", sql`views >= 0`),
	check("site_page_views_path_check", sql`path ~ '^/[a-z0-9/_-]{0,79}$'::text`),
]);

export const lessonProgress = pgTable("lesson_progress", {
	userId: uuid("user_id").notNull(),
	lessonId: uuid("lesson_id").notNull(),
	orgId: uuid("org_id"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("lesson_progress_org_idx").using("btree", table.orgId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "lesson_progress_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [catalogLessons.id],
			name: "lesson_progress_lesson_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orgId],
			foreignColumns: [organizations.id],
			name: "lesson_progress_org_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.lessonId], name: "lesson_progress_pkey"}),
	pgPolicy("lesson_progress_select_own", { as: "permissive", for: "select", to: ["authenticated"], using: sql`(user_id = auth.uid())` }),
	pgPolicy("lesson_progress_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"] }),
]);

export const productEventsDaily = pgTable("product_events_daily", {
	day: date().notNull(),
	eventName: text("event_name").notNull(),
	segment: text().default('-').notNull(),
	locale: text().default('-').notNull(),
	aiTool: text("ai_tool").default('-').notNull(),
	module: text().default('-').notNull(),
	events: integer().default(0).notNull(),
	actors: integer().default(0).notNull(),
}, (table) => [
	primaryKey({ columns: [table.day, table.eventName, table.segment, table.locale, table.aiTool, table.module], name: "product_events_daily_pkey"}),
	pgPolicy("product_events_daily_select_superadmin", { as: "permissive", for: "select", to: ["authenticated"], using: sql`is_superadmin()` }),
]);
