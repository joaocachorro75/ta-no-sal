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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "owner", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

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
    latitude: double("latitude").notNull(),
    longitude: double("longitude").notNull(),
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

export type Category = typeof categories.$inferSelect;
export type Establishment = typeof establishments.$inferSelect;
export type EstablishmentImage = typeof establishmentImages.$inferSelect;
export type CommercialPlan = typeof commercialPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type FeaturedSlot = typeof featuredSlots.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
