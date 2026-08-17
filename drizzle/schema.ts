import {
  boolean,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Identificador interno da conta; novas contas locais usam o prefixo local:. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "owner", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => ({
  emailUnique: uniqueIndex("users_email_unique").on(table.email),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 96 }).notNull(),
    slug: varchar("slug", { length: 112 }).notNull(),
    icon: varchar("icon", { length: 48 }).default("Store").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("categories_slug_unique").on(table.slug),
  }),
);

export const establishments = mysqlTable(
  "establishments",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description").notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
    streetAddress: varchar("streetAddress", { length: 255 }),
    neighborhood: varchar("neighborhood", { length: 120 }),
    city: varchar("city", { length: 120 }).default("Salinópolis").notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    isDeliveryOnly: boolean("isDeliveryOnly").default(false).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    isDemo: boolean("isDemo").default(false).notNull(),
    logoUrl: varchar("logoUrl", { length: 1024 }),
    ownerId: int("ownerId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("establishments_slug_unique").on(table.slug),
    categoryIdx: index("establishments_category_idx").on(table.categoryId),
    activeIdx: index("establishments_active_idx").on(table.isActive),
    ownerIdx: index("establishments_owner_idx").on(table.ownerId),
  }),
);

export const establishmentImages = mysqlTable(
  "establishment_images",
  {
    id: int("id").autoincrement().primaryKey(),
    establishmentId: int("establishmentId")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    imageUrl: varchar("imageUrl", { length: 1024 }).notNull(),
    altText: varchar("altText", { length: 180 }),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    establishmentIdx: index("establishment_images_establishment_idx").on(
      table.establishmentId,
    ),
  }),
);

export const commercialPlans = mysqlTable(
  "commercial_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    code: mysqlEnum("code", ["basico", "dia", "semana", "mes"]).notNull(),
    label: varchar("label", { length: 32 }).notNull(),
    priceCents: int("priceCents").default(0).notNull(),
    durationDays: int("durationDays"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    codeUnique: uniqueIndex("commercial_plans_code_unique").on(table.code),
  }),
);

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    establishmentId: int("establishmentId")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    planId: int("planId")
      .notNull()
      .references(() => commercialPlans.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["pendente", "pago", "atrasado", "cancelado"])
      .default("pendente")
      .notNull(),
    amountCents: int("amountCents").notNull(),
    dueAt: timestamp("dueAt").notNull(),
    paidAt: timestamp("paidAt"),
    confirmedByUserId: int("confirmedByUserId").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    establishmentIdx: index("subscriptions_establishment_idx").on(table.establishmentId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
  }),
);

export const favorites = mysqlTable(
  "favorites",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    establishmentId: int("establishmentId").notNull().references(() => establishments.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userIdx: index("favorites_user_idx").on(table.userId),
    establishmentIdx: index("favorites_establishment_idx").on(table.establishmentId),
    userEstablishmentUnique: uniqueIndex("favorites_user_establishment_unique").on(table.userId, table.establishmentId),
  }),
);

export const paymentSettings = mysqlTable("payment_settings", {
  id: int("id").primaryKey(),
  pixKey: varchar("pixKey", { length: 255 }),
  recipientName: varchar("recipientName", { length: 160 }),
  instructions: text("instructions"),
  dailyHighlightCapacity: int("dailyHighlightCapacity").default(5).notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const paymentRequests = mysqlTable(
  "payment_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    establishmentId: int("establishmentId").notNull().references(() => establishments.id, { onDelete: "cascade" }),
    requestedByUserId: int("requestedByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    planId: int("planId").notNull().references(() => commercialPlans.id, { onDelete: "restrict" }),
    purpose: mysqlEnum("purpose", ["assinatura", "destaque"]).notNull(),
    status: mysqlEnum("status", ["aguardando_pagamento", "em_analise", "confirmado", "recusado", "cancelado"]).default("aguardando_pagamento").notNull(),
    amountCents: int("amountCents").notNull(),
    pixProofUrl: varchar("pixProofUrl", { length: 1024 }),
    ownerNote: text("ownerNote"),
    adminNote: text("adminNote"),
    confirmedByUserId: int("confirmedByUserId").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmedAt"),
    scheduledStartsAt: timestamp("scheduledStartsAt"),
    scheduledEndsAt: timestamp("scheduledEndsAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    establishmentIdx: index("payment_requests_establishment_idx").on(table.establishmentId),
    requesterIdx: index("payment_requests_requester_idx").on(table.requestedByUserId),
    statusIdx: index("payment_requests_status_idx").on(table.status),
  }),
);

export const featuredSlots = mysqlTable(
  "featured_slots",
  {
    id: int("id").autoincrement().primaryKey(),
    establishmentId: int("establishmentId")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    planId: int("planId")
      .notNull()
      .references(() => commercialPlans.id, { onDelete: "restrict" }),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    activeWindowIdx: index("featured_slots_active_window_idx").on(
      table.isActive,
      table.startsAt,
      table.endsAt,
    ),
  }),
);

export const propertyListingPlans = mysqlTable(
  "property_listing_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    code: mysqlEnum("code", ["semana", "mes"]).notNull(),
    label: varchar("label", { length: 48 }).notNull(),
    priceCents: int("priceCents").default(0).notNull(),
    durationDays: int("durationDays").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    codeUnique: uniqueIndex("property_listing_plans_code_unique").on(table.code),
  }),
);

export const propertyListings = mysqlTable(
  "property_listings",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: int("planId").references(() => propertyListingPlans.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    listingType: mysqlEnum("listingType", ["aluguel_fixo", "temporada", "venda"]).notNull(),
    description: text("description").notNull(),
    whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
    propertyPriceCents: int("propertyPriceCents"),
    streetAddress: varchar("streetAddress", { length: 255 }),
    neighborhood: varchar("neighborhood", { length: 120 }),
    city: varchar("city", { length: 120 }).default("Salinópolis").notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    bedrooms: int("bedrooms"),
    bathrooms: int("bathrooms"),
    parkingSpaces: int("parkingSpaces"),
    status: mysqlEnum("status", ["pendente_pagamento", "em_analise", "ativo", "rejeitado", "inativo"]).default("pendente_pagamento").notNull(),
    activeUntil: timestamp("activeUntil"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    slugUnique: uniqueIndex("property_listings_slug_unique").on(table.slug),
    userIdx: index("property_listings_user_idx").on(table.userId),
    statusIdx: index("property_listings_status_idx").on(table.status),
  }),
);

export const propertyListingImages = mysqlTable(
  "property_listing_images",
  {
    id: int("id").autoincrement().primaryKey(),
    propertyListingId: int("propertyListingId").notNull().references(() => propertyListings.id, { onDelete: "cascade" }),
    imageUrl: varchar("imageUrl", { length: 1024 }).notNull(),
    altText: varchar("altText", { length: 180 }),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ propertyIdx: index("property_listing_images_property_idx").on(table.propertyListingId) }),
);

export const propertyPaymentRequests = mysqlTable(
  "property_payment_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    propertyListingId: int("propertyListingId").notNull().references(() => propertyListings.id, { onDelete: "cascade" }),
    requestedByUserId: int("requestedByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    planId: int("planId").notNull().references(() => propertyListingPlans.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["aguardando_pagamento", "em_analise", "confirmado", "recusado", "cancelado"]).default("aguardando_pagamento").notNull(),
    amountCents: int("amountCents").notNull(),
    pixProofUrl: varchar("pixProofUrl", { length: 1024 }),
    ownerNote: text("ownerNote"),
    adminNote: text("adminNote"),
    confirmedByUserId: int("confirmedByUserId").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ propertyIdx: index("property_payment_requests_property_idx").on(table.propertyListingId), statusIdx: index("property_payment_requests_status_idx").on(table.status) }),
);

export const muralPosts = mysqlTable(
  "mural_posts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    caption: text("caption").notNull(),
    allowsComments: boolean("allowsComments").default(true).notNull(),
    latitude: double("latitude"),
    longitude: double("longitude"),
    locationLabel: varchar("locationLabel", { length: 180 }),
    status: mysqlEnum("status", ["pendente", "aprovado", "recusado"]).default("pendente").notNull(),
    adminNote: text("adminNote"),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({ userIdx: index("mural_posts_user_idx").on(table.userId), statusIdx: index("mural_posts_status_idx").on(table.status, table.createdAt) }),
);

export const muralPostImages = mysqlTable(
  "mural_post_images",
  {
    id: int("id").autoincrement().primaryKey(),
    muralPostId: int("muralPostId").notNull().references(() => muralPosts.id, { onDelete: "cascade" }),
    imageUrl: varchar("imageUrl", { length: 1024 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ postIdx: index("mural_post_images_post_idx").on(table.muralPostId) }),
);

export const muralLikes = mysqlTable(
  "mural_likes",
  {
    id: int("id").autoincrement().primaryKey(),
    muralPostId: int("muralPostId").notNull().references(() => muralPosts.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ postIdx: index("mural_likes_post_idx").on(table.muralPostId), uniqueLike: uniqueIndex("mural_likes_unique").on(table.muralPostId, table.userId) }),
);

export const muralComments = mysqlTable(
  "mural_comments",
  {
    id: int("id").autoincrement().primaryKey(),
    muralPostId: int("muralPostId").notNull().references(() => muralPosts.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["pendente", "aprovado", "recusado"]).default("pendente").notNull(),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({ postIdx: index("mural_comments_post_idx").on(table.muralPostId), statusIdx: index("mural_comments_status_idx").on(table.status) }),
);

export type Category = typeof categories.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type EstablishmentImage = typeof establishmentImages.$inferSelect;
export type CommercialPlan = typeof commercialPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type FeaturedSlot = typeof featuredSlots.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type PropertyListingPlan = typeof propertyListingPlans.$inferSelect;
export type PropertyListing = typeof propertyListings.$inferSelect;
export type PropertyListingImage = typeof propertyListingImages.$inferSelect;
export type PropertyPaymentRequest = typeof propertyPaymentRequests.$inferSelect;
export type MuralPost = typeof muralPosts.$inferSelect;
export type MuralPostImage = typeof muralPostImages.$inferSelect;
export type MuralLike = typeof muralLikes.$inferSelect;
export type MuralComment = typeof muralComments.$inferSelect;
