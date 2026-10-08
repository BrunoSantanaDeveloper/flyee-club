// GENERATED from packages/db/migrations by `npm run db:schema:pull`.
// Regenerate after every migration instead of editing by hand.
import { relations } from "drizzle-orm/relations";
import { usersInAuth, profiles, organizations, memberships, auditEvents, consentTerms, consentAcceptances, accessEvents, platformSettings, notifications, announcements, onboardingState, subscriptions, plans, coupons, billingOperations, subscriptionModules, modules, invoices, entitlementGrants, metaAttribution, signupAttribution, purchaseAttributions, productEvents, helpCategories, helpArticles, blogPosts, blogComments, catalogTrails, catalogModules, catalogStoreCategories, catalogModuleVersions, catalogLessons, catalogLessonVideos, roadmapItems, catalogRecipes, catalogRecipeWorkflows, oauthClients, oauthGrants, oauthTokens, oauthDeviceCodes, memberDevices, cliRequests, leads, moduleDownloads, impersonationSessions, meetings, meetingLinks, meetingRegistrations, newsletterSends, aiSpend, announcementDismissals, catalogRecipeModules, newsletterDeliveries, roadmapVotes, lessonProgress, catalogGuides } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	organizations: many(organizations),
	memberships: many(memberships),
	auditEvents: many(auditEvents),
	consentAcceptances: many(consentAcceptances),
	accessEvents_userId: many(accessEvents, {
		relationName: "accessEvents_userId_profiles_id"
	}),
	accessEvents_impersonatedBy: many(accessEvents, {
		relationName: "accessEvents_impersonatedBy_profiles_id"
	}),
	platformSettings: many(platformSettings),
	notifications: many(notifications),
	announcements: many(announcements),
	onboardingStates: many(onboardingState),
	entitlementGrants: many(entitlementGrants),
	billingOperations: many(billingOperations),
	productEvents: many(productEvents),
	blogComments: many(blogComments),
	catalogModules: many(catalogModules),
	catalogModuleVersions: many(catalogModuleVersions),
	roadmapItems_createdBy: many(roadmapItems, {
		relationName: "roadmapItems_createdBy_profiles_id"
	}),
	roadmapItems_proposedBy: many(roadmapItems, {
		relationName: "roadmapItems_proposedBy_profiles_id"
	}),
	oauthGrants: many(oauthGrants),
	oauthTokens: many(oauthTokens),
	oauthDeviceCodes: many(oauthDeviceCodes),
	memberDevices: many(memberDevices),
	moduleDownloads: many(moduleDownloads),
	impersonationSessions_actorId: many(impersonationSessions, {
		relationName: "impersonationSessions_actorId_profiles_id"
	}),
	impersonationSessions_targetUserId: many(impersonationSessions, {
		relationName: "impersonationSessions_targetUserId_profiles_id"
	}),
	meetings: many(meetings),
	meetingRegistrations: many(meetingRegistrations),
	newsletterSends: many(newsletterSends),
	announcementDismissals: many(announcementDismissals),
	roadmapVotes: many(roadmapVotes),
	lessonProgresses: many(lessonProgress),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
	aiSpends: many(aiSpend),
}));

export const organizationsRelations = relations(organizations, ({one, many}) => ({
	profile: one(profiles, {
		fields: [organizations.createdBy],
		references: [profiles.id]
	}),
	memberships: many(memberships),
	auditEvents: many(auditEvents),
	consentAcceptances: many(consentAcceptances),
	onboardingStates: many(onboardingState),
	subscriptions: many(subscriptions),
	invoices: many(invoices),
	entitlementGrants: many(entitlementGrants),
	billingOperations: many(billingOperations),
	metaAttributions: many(metaAttribution),
	signupAttributions: many(signupAttribution),
	purchaseAttributions: many(purchaseAttributions),
	productEvents: many(productEvents),
	oauthGrants: many(oauthGrants),
	oauthTokens: many(oauthTokens),
	oauthDeviceCodes: many(oauthDeviceCodes),
	memberDevices: many(memberDevices),
	cliRequests: many(cliRequests),
	moduleDownloads: many(moduleDownloads),
	impersonationSessions: many(impersonationSessions),
	meetingRegistrations: many(meetingRegistrations),
	aiSpends: many(aiSpend),
	roadmapVotes: many(roadmapVotes),
	lessonProgresses: many(lessonProgress),
}));

export const membershipsRelations = relations(memberships, ({one}) => ({
	organization: one(organizations, {
		fields: [memberships.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [memberships.userId],
		references: [profiles.id]
	}),
}));

export const auditEventsRelations = relations(auditEvents, ({one}) => ({
	organization: one(organizations, {
		fields: [auditEvents.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [auditEvents.actorId],
		references: [profiles.id]
	}),
}));

export const consentAcceptancesRelations = relations(consentAcceptances, ({one}) => ({
	consentTerm: one(consentTerms, {
		fields: [consentAcceptances.termId],
		references: [consentTerms.id]
	}),
	organization: one(organizations, {
		fields: [consentAcceptances.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [consentAcceptances.userId],
		references: [profiles.id]
	}),
}));

export const consentTermsRelations = relations(consentTerms, ({many}) => ({
	consentAcceptances: many(consentAcceptances),
	leads: many(leads),
}));

export const accessEventsRelations = relations(accessEvents, ({one}) => ({
	profile_userId: one(profiles, {
		fields: [accessEvents.userId],
		references: [profiles.id],
		relationName: "accessEvents_userId_profiles_id"
	}),
	profile_impersonatedBy: one(profiles, {
		fields: [accessEvents.impersonatedBy],
		references: [profiles.id],
		relationName: "accessEvents_impersonatedBy_profiles_id"
	}),
}));

export const platformSettingsRelations = relations(platformSettings, ({one}) => ({
	profile: one(profiles, {
		fields: [platformSettings.updatedBy],
		references: [profiles.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	profile: one(profiles, {
		fields: [notifications.userId],
		references: [profiles.id]
	}),
}));

export const announcementsRelations = relations(announcements, ({one, many}) => ({
	profile: one(profiles, {
		fields: [announcements.createdBy],
		references: [profiles.id]
	}),
	announcementDismissals: many(announcementDismissals),
}));

export const onboardingStateRelations = relations(onboardingState, ({one}) => ({
	profile: one(profiles, {
		fields: [onboardingState.userId],
		references: [profiles.id]
	}),
	organization: one(organizations, {
		fields: [onboardingState.orgId],
		references: [organizations.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one, many}) => ({
	organization: one(organizations, {
		fields: [subscriptions.orgId],
		references: [organizations.id]
	}),
	plan: one(plans, {
		fields: [subscriptions.planId],
		references: [plans.id]
	}),
	coupon: one(coupons, {
		fields: [subscriptions.couponId],
		references: [coupons.id]
	}),
	billingOperation: one(billingOperations, {
		fields: [subscriptions.billingOperationId],
		references: [billingOperations.id],
		relationName: "subscriptions_billingOperationId_billingOperations_id"
	}),
	subscriptionModules: many(subscriptionModules),
	invoices: many(invoices),
	billingOperations: many(billingOperations, {
		relationName: "billingOperations_subscriptionId_subscriptions_id"
	}),
}));

export const plansRelations = relations(plans, ({many}) => ({
	subscriptions: many(subscriptions),
	invoices: many(invoices),
	entitlementGrants: many(entitlementGrants),
	billingOperations: many(billingOperations),
}));

export const couponsRelations = relations(coupons, ({many}) => ({
	subscriptions: many(subscriptions),
}));

export const billingOperationsRelations = relations(billingOperations, ({one, many}) => ({
	subscriptions: many(subscriptions, {
		relationName: "subscriptions_billingOperationId_billingOperations_id"
	}),
	organization: one(organizations, {
		fields: [billingOperations.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [billingOperations.actorId],
		references: [profiles.id]
	}),
	plan: one(plans, {
		fields: [billingOperations.planId],
		references: [plans.id]
	}),
	subscription: one(subscriptions, {
		fields: [billingOperations.subscriptionId],
		references: [subscriptions.id],
		relationName: "billingOperations_subscriptionId_subscriptions_id"
	}),
}));

export const subscriptionModulesRelations = relations(subscriptionModules, ({one}) => ({
	subscription: one(subscriptions, {
		fields: [subscriptionModules.subscriptionId],
		references: [subscriptions.id]
	}),
	module: one(modules, {
		fields: [subscriptionModules.moduleId],
		references: [modules.id]
	}),
}));

export const modulesRelations = relations(modules, ({many}) => ({
	subscriptionModules: many(subscriptionModules),
}));

export const invoicesRelations = relations(invoices, ({one}) => ({
	organization: one(organizations, {
		fields: [invoices.orgId],
		references: [organizations.id]
	}),
	subscription: one(subscriptions, {
		fields: [invoices.subscriptionId],
		references: [subscriptions.id]
	}),
	plan: one(plans, {
		fields: [invoices.planId],
		references: [plans.id]
	}),
}));

export const entitlementGrantsRelations = relations(entitlementGrants, ({one}) => ({
	profile: one(profiles, {
		fields: [entitlementGrants.grantedBy],
		references: [profiles.id]
	}),
	organization: one(organizations, {
		fields: [entitlementGrants.orgId],
		references: [organizations.id]
	}),
	plan: one(plans, {
		fields: [entitlementGrants.planId],
		references: [plans.id]
	}),
}));

export const metaAttributionRelations = relations(metaAttribution, ({one}) => ({
	organization: one(organizations, {
		fields: [metaAttribution.orgId],
		references: [organizations.id]
	}),
}));

export const signupAttributionRelations = relations(signupAttribution, ({one}) => ({
	organization: one(organizations, {
		fields: [signupAttribution.orgId],
		references: [organizations.id]
	}),
}));

export const purchaseAttributionsRelations = relations(purchaseAttributions, ({one}) => ({
	organization: one(organizations, {
		fields: [purchaseAttributions.orgId],
		references: [organizations.id]
	}),
}));

export const productEventsRelations = relations(productEvents, ({one}) => ({
	organization: one(organizations, {
		fields: [productEvents.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [productEvents.actorId],
		references: [profiles.id]
	}),
}));

export const helpArticlesRelations = relations(helpArticles, ({one}) => ({
	helpCategory: one(helpCategories, {
		fields: [helpArticles.categoryId],
		references: [helpCategories.id]
	}),
}));

export const helpCategoriesRelations = relations(helpCategories, ({many}) => ({
	helpArticles: many(helpArticles),
}));

export const blogCommentsRelations = relations(blogComments, ({one}) => ({
	blogPost: one(blogPosts, {
		fields: [blogComments.postId],
		references: [blogPosts.id]
	}),
	profile: one(profiles, {
		fields: [blogComments.userId],
		references: [profiles.id]
	}),
}));

export const blogPostsRelations = relations(blogPosts, ({many}) => ({
	blogComments: many(blogComments),
}));

export const catalogModulesRelations = relations(catalogModules, ({one, many}) => ({
	catalogTrail: one(catalogTrails, {
		fields: [catalogModules.trail],
		references: [catalogTrails.slug]
	}),
	profile: one(profiles, {
		fields: [catalogModules.createdBy],
		references: [profiles.id]
	}),
	catalogStoreCategory: one(catalogStoreCategories, {
		fields: [catalogModules.storeCategory],
		references: [catalogStoreCategories.slug]
	}),
	catalogModuleVersions: many(catalogModuleVersions),
	catalogLessons: many(catalogLessons),
	roadmapItems: many(roadmapItems),
	moduleDownloads: many(moduleDownloads),
	catalogRecipeModules: many(catalogRecipeModules),
}));

export const catalogTrailsRelations = relations(catalogTrails, ({many}) => ({
	catalogModules: many(catalogModules),
	roadmapItems: many(roadmapItems),
}));

export const catalogStoreCategoriesRelations = relations(catalogStoreCategories, ({many}) => ({
	catalogModules: many(catalogModules),
}));

export const catalogModuleVersionsRelations = relations(catalogModuleVersions, ({one, many}) => ({
	catalogModule: one(catalogModules, {
		fields: [catalogModuleVersions.moduleId],
		references: [catalogModules.id]
	}),
	profile: one(profiles, {
		fields: [catalogModuleVersions.createdBy],
		references: [profiles.id]
	}),
	moduleDownloads: many(moduleDownloads),
	catalogGuides: many(catalogGuides),
}));

export const catalogLessonsRelations = relations(catalogLessons, ({one, many}) => ({
	catalogModule: one(catalogModules, {
		fields: [catalogLessons.moduleId],
		references: [catalogModules.id]
	}),
	catalogLessonVideos: many(catalogLessonVideos),
	lessonProgresses: many(lessonProgress),
}));

export const catalogLessonVideosRelations = relations(catalogLessonVideos, ({one}) => ({
	catalogLesson: one(catalogLessons, {
		fields: [catalogLessonVideos.lessonId],
		references: [catalogLessons.id]
	}),
}));

export const roadmapItemsRelations = relations(roadmapItems, ({one, many}) => ({
	catalogTrail: one(catalogTrails, {
		fields: [roadmapItems.trail],
		references: [catalogTrails.slug]
	}),
	catalogModule: one(catalogModules, {
		fields: [roadmapItems.shippedModuleId],
		references: [catalogModules.id]
	}),
	profile_createdBy: one(profiles, {
		fields: [roadmapItems.createdBy],
		references: [profiles.id],
		relationName: "roadmapItems_createdBy_profiles_id"
	}),
	profile_proposedBy: one(profiles, {
		fields: [roadmapItems.proposedBy],
		references: [profiles.id],
		relationName: "roadmapItems_proposedBy_profiles_id"
	}),
	roadmapVotes: many(roadmapVotes),
}));

export const catalogRecipeWorkflowsRelations = relations(catalogRecipeWorkflows, ({one}) => ({
	catalogRecipe: one(catalogRecipes, {
		fields: [catalogRecipeWorkflows.recipeId],
		references: [catalogRecipes.id]
	}),
}));

export const catalogRecipesRelations = relations(catalogRecipes, ({many}) => ({
	catalogRecipeWorkflows: many(catalogRecipeWorkflows),
	catalogRecipeModules: many(catalogRecipeModules),
}));

export const oauthGrantsRelations = relations(oauthGrants, ({one}) => ({
	oauthClient: one(oauthClients, {
		fields: [oauthGrants.clientId],
		references: [oauthClients.id]
	}),
	organization: one(organizations, {
		fields: [oauthGrants.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [oauthGrants.userId],
		references: [profiles.id]
	}),
}));

export const oauthClientsRelations = relations(oauthClients, ({many}) => ({
	oauthGrants: many(oauthGrants),
	oauthTokens: many(oauthTokens),
	oauthDeviceCodes: many(oauthDeviceCodes),
}));

export const oauthTokensRelations = relations(oauthTokens, ({one, many}) => ({
	oauthClient: one(oauthClients, {
		fields: [oauthTokens.clientId],
		references: [oauthClients.id]
	}),
	organization: one(organizations, {
		fields: [oauthTokens.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [oauthTokens.userId],
		references: [profiles.id]
	}),
	cliRequests: many(cliRequests),
}));

export const oauthDeviceCodesRelations = relations(oauthDeviceCodes, ({one}) => ({
	oauthClient: one(oauthClients, {
		fields: [oauthDeviceCodes.clientId],
		references: [oauthClients.id]
	}),
	profile: one(profiles, {
		fields: [oauthDeviceCodes.userId],
		references: [profiles.id]
	}),
	organization: one(organizations, {
		fields: [oauthDeviceCodes.orgId],
		references: [organizations.id]
	}),
}));

export const memberDevicesRelations = relations(memberDevices, ({one}) => ({
	organization: one(organizations, {
		fields: [memberDevices.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [memberDevices.userId],
		references: [profiles.id]
	}),
}));

export const cliRequestsRelations = relations(cliRequests, ({one}) => ({
	organization: one(organizations, {
		fields: [cliRequests.orgId],
		references: [organizations.id]
	}),
	oauthToken: one(oauthTokens, {
		fields: [cliRequests.tokenId],
		references: [oauthTokens.id]
	}),
}));

export const leadsRelations = relations(leads, ({one, many}) => ({
	consentTerm: one(consentTerms, {
		fields: [leads.consentTermId],
		references: [consentTerms.id]
	}),
	newsletterDeliveries: many(newsletterDeliveries),
}));

export const moduleDownloadsRelations = relations(moduleDownloads, ({one}) => ({
	organization: one(organizations, {
		fields: [moduleDownloads.orgId],
		references: [organizations.id]
	}),
	profile: one(profiles, {
		fields: [moduleDownloads.userId],
		references: [profiles.id]
	}),
	catalogModule: one(catalogModules, {
		fields: [moduleDownloads.moduleId],
		references: [catalogModules.id]
	}),
	catalogModuleVersion: one(catalogModuleVersions, {
		fields: [moduleDownloads.versionId],
		references: [catalogModuleVersions.id]
	}),
}));

export const impersonationSessionsRelations = relations(impersonationSessions, ({one}) => ({
	organization: one(organizations, {
		fields: [impersonationSessions.targetOrgId],
		references: [organizations.id]
	}),
	profile_actorId: one(profiles, {
		fields: [impersonationSessions.actorId],
		references: [profiles.id],
		relationName: "impersonationSessions_actorId_profiles_id"
	}),
	profile_targetUserId: one(profiles, {
		fields: [impersonationSessions.targetUserId],
		references: [profiles.id],
		relationName: "impersonationSessions_targetUserId_profiles_id"
	}),
}));

export const meetingsRelations = relations(meetings, ({one, many}) => ({
	profile: one(profiles, {
		fields: [meetings.updatedBy],
		references: [profiles.id]
	}),
	meetingLinks: many(meetingLinks),
	meetingRegistrations: many(meetingRegistrations),
}));

export const meetingLinksRelations = relations(meetingLinks, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingLinks.meetingId],
		references: [meetings.id]
	}),
}));

export const meetingRegistrationsRelations = relations(meetingRegistrations, ({one}) => ({
	meeting: one(meetings, {
		fields: [meetingRegistrations.meetingId],
		references: [meetings.id]
	}),
	profile: one(profiles, {
		fields: [meetingRegistrations.userId],
		references: [profiles.id]
	}),
	organization: one(organizations, {
		fields: [meetingRegistrations.orgId],
		references: [organizations.id]
	}),
}));

export const newsletterSendsRelations = relations(newsletterSends, ({one, many}) => ({
	profile: one(profiles, {
		fields: [newsletterSends.createdBy],
		references: [profiles.id]
	}),
	newsletterDeliveries: many(newsletterDeliveries),
}));

export const aiSpendRelations = relations(aiSpend, ({one}) => ({
	organization: one(organizations, {
		fields: [aiSpend.orgId],
		references: [organizations.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [aiSpend.createdBy],
		references: [usersInAuth.id]
	}),
}));

export const announcementDismissalsRelations = relations(announcementDismissals, ({one}) => ({
	announcement: one(announcements, {
		fields: [announcementDismissals.announcementId],
		references: [announcements.id]
	}),
	profile: one(profiles, {
		fields: [announcementDismissals.userId],
		references: [profiles.id]
	}),
}));

export const catalogRecipeModulesRelations = relations(catalogRecipeModules, ({one}) => ({
	catalogRecipe: one(catalogRecipes, {
		fields: [catalogRecipeModules.recipeId],
		references: [catalogRecipes.id]
	}),
	catalogModule: one(catalogModules, {
		fields: [catalogRecipeModules.moduleId],
		references: [catalogModules.id]
	}),
}));

export const newsletterDeliveriesRelations = relations(newsletterDeliveries, ({one}) => ({
	newsletterSend: one(newsletterSends, {
		fields: [newsletterDeliveries.sendId],
		references: [newsletterSends.id]
	}),
	lead: one(leads, {
		fields: [newsletterDeliveries.leadId],
		references: [leads.id]
	}),
}));

export const roadmapVotesRelations = relations(roadmapVotes, ({one}) => ({
	roadmapItem: one(roadmapItems, {
		fields: [roadmapVotes.itemId],
		references: [roadmapItems.id]
	}),
	profile: one(profiles, {
		fields: [roadmapVotes.userId],
		references: [profiles.id]
	}),
	organization: one(organizations, {
		fields: [roadmapVotes.orgId],
		references: [organizations.id]
	}),
}));

export const lessonProgressRelations = relations(lessonProgress, ({one}) => ({
	profile: one(profiles, {
		fields: [lessonProgress.userId],
		references: [profiles.id]
	}),
	catalogLesson: one(catalogLessons, {
		fields: [lessonProgress.lessonId],
		references: [catalogLessons.id]
	}),
	organization: one(organizations, {
		fields: [lessonProgress.orgId],
		references: [organizations.id]
	}),
}));

export const catalogGuidesRelations = relations(catalogGuides, ({one}) => ({
	catalogModuleVersion: one(catalogModuleVersions, {
		fields: [catalogGuides.versionId],
		references: [catalogModuleVersions.id]
	}),
}));