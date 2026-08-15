import { and, asc, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  commercialPlans,
  establishmentImages,
  establishments,
  favorites,
  featuredSlots,
  InsertUser,
  paymentRequests,
  paymentSettings,
  subscriptions,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  return db;
}

type PaymentPurpose = "assinatura" | "destaque";
type PaymentRequestStatus = "aguardando_pagamento" | "em_analise" | "confirmado" | "recusado" | "cancelado";
type SubscriptionStatus = "pendente" | "pago" | "atrasado" | "cancelado";

async function isOwnedByUser(establishmentId: number, userId: number) {
  const db = await requireDb();
  const [establishment] = await db.select({ id: establishments.id }).from(establishments).where(and(eq(establishments.id, establishmentId), eq(establishments.ownerId, userId))).limit(1);
  return Boolean(establishment);
}

export async function promoteUserToOwner(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ role: "owner" }).where(and(eq(users.id, userId), eq(users.role, "user")));
}

export async function getFavoriteIds(userId: number) {
  const db = await requireDb();
  const rows = await db.select({ establishmentId: favorites.establishmentId }).from(favorites).where(eq(favorites.userId, userId));
  return rows.map(row => row.establishmentId);
}

export async function addFavorite(userId: number, establishmentId: number) {
  const db = await requireDb();
  const [establishment] = await db.select({ id: establishments.id }).from(establishments).where(and(eq(establishments.id, establishmentId), eq(establishments.isActive, true))).limit(1);
  if (!establishment) throw new Error("Estabelecimento indisponível para favoritos.");
  await db.insert(favorites).values({ userId, establishmentId }).onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
}

export async function removeFavorite(userId: number, establishmentId: number) {
  const db = await requireDb();
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.establishmentId, establishmentId)));
}

export async function getFavoriteDirectory(userId: number) {
  const db = await requireDb();
  const [rows, images] = await Promise.all([
    db.select({
      id: establishments.id,
      name: establishments.name,
      slug: establishments.slug,
      description: establishments.description,
      streetAddress: establishments.streetAddress,
      neighborhood: establishments.neighborhood,
      city: establishments.city,
      latitude: establishments.latitude,
      longitude: establishments.longitude,
      isDeliveryOnly: establishments.isDeliveryOnly,
      isDemo: establishments.isDemo,
      logoUrl: establishments.logoUrl,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryIcon: categories.icon,
    }).from(favorites).innerJoin(establishments, eq(favorites.establishmentId, establishments.id)).innerJoin(categories, eq(establishments.categoryId, categories.id)).where(and(eq(favorites.userId, userId), eq(establishments.isActive, true))).orderBy(desc(favorites.createdAt)),
    db.select().from(establishmentImages).orderBy(asc(establishmentImages.sortOrder)),
  ]);
  const imageMap = makeImageMap(images);
  return rows.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] }));
}

export async function getPaymentSettings() {
  const db = await requireDb();
  const [settings] = await db.select().from(paymentSettings).where(eq(paymentSettings.id, 1)).limit(1);
  return settings ?? { id: 1, pixKey: null, recipientName: null, instructions: null };
}

export async function updatePaymentSettings(input: { pixKey?: string | null; recipientName?: string | null; instructions?: string | null; updatedByUserId: number }) {
  const db = await requireDb();
  await db.insert(paymentSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
}

export async function enforceExpiredSubscriptions(now = new Date()) {
  const db = await requireDb();
  const rows = await db.select({ subscription: subscriptions }).from(subscriptions).innerJoin(commercialPlans, eq(subscriptions.planId, commercialPlans.id)).where(eq(commercialPlans.code, "basico")).orderBy(desc(subscriptions.createdAt));
  const latestByEstablishment = new Map<number, typeof rows[number]["subscription"]>();
  for (const row of rows) if (!latestByEstablishment.has(row.subscription.establishmentId)) latestByEstablishment.set(row.subscription.establishmentId, row.subscription);
  const overdue = Array.from(latestByEstablishment.values()).filter(subscription => subscription.dueAt <= now && (subscription.status === "pago" || subscription.status === "pendente"));
  for (const subscription of overdue) {
    await db.update(subscriptions).set({ status: "atrasado" }).where(eq(subscriptions.id, subscription.id));
    await db.update(establishments).set({ isActive: false }).where(and(eq(establishments.id, subscription.establishmentId), eq(establishments.isDemo, false)));
  }
  return { suspended: overdue.map(subscription => subscription.establishmentId) };
}

export async function createOwnedEstablishment(input: EstablishmentInput, ownerId: number) {
  await promoteUserToOwner(ownerId);
  await createEstablishment({ ...input, ownerId, isActive: false, isDemo: false });
}

export async function updateOwnedEstablishment(input: Partial<EstablishmentInput> & { id: number }, ownerId: number) {
  if (!(await isOwnedByUser(input.id, ownerId))) throw new Error("Você não pode editar este estabelecimento.");
  const { isActive: _isActive, isDemo: _isDemo, ...safeInput } = input;
  await updateEstablishment(safeInput);
}

export async function getOwnerOverview(ownerId: number) {
  const db = await requireDb();
  const [establishmentRows, images, planRows, requestRows, settings] = await Promise.all([
    db.select({
      id: establishments.id,
      categoryId: establishments.categoryId,
      categoryName: categories.name,
      name: establishments.name,
      slug: establishments.slug,
      description: establishments.description,
      whatsapp: establishments.whatsapp,
      streetAddress: establishments.streetAddress,
      neighborhood: establishments.neighborhood,
      city: establishments.city,
      latitude: establishments.latitude,
      longitude: establishments.longitude,
      isDeliveryOnly: establishments.isDeliveryOnly,
      isActive: establishments.isActive,
      logoUrl: establishments.logoUrl,
    }).from(establishments).innerJoin(categories, eq(establishments.categoryId, categories.id)).where(eq(establishments.ownerId, ownerId)).orderBy(asc(establishments.name)),
    db.select().from(establishmentImages).orderBy(asc(establishmentImages.sortOrder)),
    db.select().from(commercialPlans).where(eq(commercialPlans.isActive, true)).orderBy(asc(commercialPlans.id)),
    db.select().from(paymentRequests).where(eq(paymentRequests.requestedByUserId, ownerId)).orderBy(desc(paymentRequests.createdAt)),
    getPaymentSettings(),
  ]);
  const imageMap = makeImageMap(images);
  return {
    establishments: establishmentRows.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] })),
    plans: planRows,
    paymentRequests: requestRows,
    paymentSettings: settings,
  };
}

export async function createOwnerPaymentRequest(input: { establishmentId: number; planId: number; purpose: PaymentPurpose; ownerNote?: string | null }, ownerId: number) {
  if (!(await isOwnedByUser(input.establishmentId, ownerId))) throw new Error("Você não pode solicitar pagamento para este estabelecimento.");
  const db = await requireDb();
  const [plan] = await db.select().from(commercialPlans).where(and(eq(commercialPlans.id, input.planId), eq(commercialPlans.isActive, true))).limit(1);
  if (!plan) throw new Error("Plano indisponível.");
  if (input.purpose === "assinatura" && plan.code !== "basico") throw new Error("Use o plano básico para assinatura.");
  if (input.purpose === "destaque" && plan.code === "basico") throw new Error("Escolha um plano de destaque.");
  await db.insert(paymentRequests).values({ ...input, requestedByUserId: ownerId, amountCents: plan.priceCents, status: "aguardando_pagamento" });
}

export async function submitPixProof(input: { requestId: number; pixProofUrl: string; ownerNote?: string | null }, ownerId: number) {
  const db = await requireDb();
  const [request] = await db.select().from(paymentRequests).where(and(eq(paymentRequests.id, input.requestId), eq(paymentRequests.requestedByUserId, ownerId))).limit(1);
  if (!request) throw new Error("Solicitação de pagamento não encontrada.");
  if (request.status !== "aguardando_pagamento") throw new Error("Esta solicitação não aceita mais comprovante.");
  await db.update(paymentRequests).set({ pixProofUrl: input.pixProofUrl, ownerNote: input.ownerNote ?? request.ownerNote, status: "em_analise" }).where(eq(paymentRequests.id, input.requestId));
}

export async function getAdminPaymentRequests() {
  const db = await requireDb();
  return db.select({
    id: paymentRequests.id,
    establishmentId: paymentRequests.establishmentId,
    establishmentName: establishments.name,
    requesterName: users.name,
    planId: paymentRequests.planId,
    purpose: paymentRequests.purpose,
    status: paymentRequests.status,
    amountCents: paymentRequests.amountCents,
    pixProofUrl: paymentRequests.pixProofUrl,
    ownerNote: paymentRequests.ownerNote,
    adminNote: paymentRequests.adminNote,
    confirmedAt: paymentRequests.confirmedAt,
    createdAt: paymentRequests.createdAt,
  }).from(paymentRequests).innerJoin(establishments, eq(paymentRequests.establishmentId, establishments.id)).innerJoin(users, eq(paymentRequests.requestedByUserId, users.id)).orderBy(desc(paymentRequests.createdAt));
}

export async function confirmPaymentRequest(input: { requestId: number; adminNote?: string | null; displayOrder?: number }, adminUserId: number) {
  const db = await requireDb();
  const [request] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.requestId)).limit(1);
  if (!request) throw new Error("Solicitação de pagamento não encontrada.");
  if (request.status !== "em_analise") throw new Error("Confirme somente pagamentos com comprovante enviado.");
  const [plan] = await db.select().from(commercialPlans).where(eq(commercialPlans.id, request.planId)).limit(1);
  if (!plan) throw new Error("Plano não encontrado.");
  const now = new Date();
  await db.update(paymentRequests).set({ status: "confirmado", adminNote: input.adminNote ?? null, confirmedAt: now, confirmedByUserId: adminUserId }).where(eq(paymentRequests.id, request.id));
  if (request.purpose === "assinatura") {
    const dueAt = new Date(now.getTime() + (plan.durationDays ?? 30) * 24 * 60 * 60 * 1000);
    await db.insert(subscriptions).values({ establishmentId: request.establishmentId, planId: request.planId, status: "pago", amountCents: request.amountCents, dueAt, paidAt: now, confirmedByUserId: adminUserId, notes: input.adminNote ?? null });
    await db.update(establishments).set({ isActive: true }).where(eq(establishments.id, request.establishmentId));
  } else {
    const endsAt = new Date(now.getTime() + (plan.durationDays ?? 1) * 24 * 60 * 60 * 1000);
    await db.insert(featuredSlots).values({ establishmentId: request.establishmentId, planId: request.planId, startsAt: now, endsAt, displayOrder: input.displayOrder ?? 0, isActive: true });
  }
}

export async function rejectPaymentRequest(input: { requestId: number; adminNote?: string | null }, adminUserId: number) {
  const db = await requireDb();
  const [request] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, input.requestId)).limit(1);
  if (!request) throw new Error("Solicitação de pagamento não encontrada.");
  if (request.status !== "em_analise") throw new Error("Esta solicitação não está em análise.");
  await db.update(paymentRequests).set({ status: "recusado", adminNote: input.adminNote ?? null, confirmedByUserId: adminUserId, confirmedAt: new Date() }).where(eq(paymentRequests.id, request.id));
}

export async function ensureCommercialPlans() {
  const db = await requireDb();
  await db.insert(commercialPlans).values([
    { code: "basico", label: "básico", priceCents: 0, durationDays: 30 },
    { code: "dia", label: "dia", priceCents: 0, durationDays: 1 },
    { code: "semana", label: "semana", priceCents: 0, durationDays: 7 },
    { code: "mes", label: "mês", priceCents: 0, durationDays: 30 },
  ]).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  await db.update(commercialPlans).set({ durationDays: 30 }).where(eq(commercialPlans.code, "basico"));
}

function makeImageMap(rows: { establishmentId: number; imageUrl: string }[]) {
  return rows.reduce<Map<number, string[]>>((map, image) => {
    map.set(image.establishmentId, [...(map.get(image.establishmentId) ?? []), image.imageUrl]);
    return map;
  }, new Map());
}

export async function getPublicCategories() {
  const db = await requireDb();
  return db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));
}

export async function getPublicDirectory(input: { search?: string; categorySlug?: string }) {
  await enforceExpiredSubscriptions();
  const db = await requireDb();
  const conditions = [eq(establishments.isActive, true)];
  if (input.categorySlug) conditions.push(eq(categories.slug, input.categorySlug));
  if (input.search?.trim()) conditions.push(like(establishments.name, `%${input.search.trim()}%`));

  const [rows, images] = await Promise.all([
    db
      .select({
        id: establishments.id,
        name: establishments.name,
        slug: establishments.slug,
        description: establishments.description,
        streetAddress: establishments.streetAddress,
        neighborhood: establishments.neighborhood,
        city: establishments.city,
        latitude: establishments.latitude,
        longitude: establishments.longitude,
        isDeliveryOnly: establishments.isDeliveryOnly,
        isDemo: establishments.isDemo,
        logoUrl: establishments.logoUrl,
        categoryName: categories.name,
        categorySlug: categories.slug,
        categoryIcon: categories.icon,
      })
      .from(establishments)
      .innerJoin(categories, eq(establishments.categoryId, categories.id))
      .where(and(...conditions))
      .orderBy(asc(establishments.name)),
    db.select().from(establishmentImages).orderBy(asc(establishmentImages.sortOrder)),
  ]);
  const imageMap = makeImageMap(images);
  return rows.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] }));
}

export async function getPublicFeatured() {
  await enforceExpiredSubscriptions();
  const db = await requireDb();
  const now = new Date();
  const [rows, images] = await Promise.all([
    db
      .select({
        id: establishments.id,
        name: establishments.name,
        slug: establishments.slug,
        description: establishments.description,
        latitude: establishments.latitude,
        longitude: establishments.longitude,
        isDeliveryOnly: establishments.isDeliveryOnly,
        isDemo: establishments.isDemo,
        logoUrl: establishments.logoUrl,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        planLabel: commercialPlans.label,
        displayOrder: featuredSlots.displayOrder,
      })
      .from(featuredSlots)
      .innerJoin(establishments, eq(featuredSlots.establishmentId, establishments.id))
      .innerJoin(categories, eq(establishments.categoryId, categories.id))
      .innerJoin(commercialPlans, eq(featuredSlots.planId, commercialPlans.id))
      .where(
        and(
          eq(featuredSlots.isActive, true),
          eq(establishments.isActive, true),
          lte(featuredSlots.startsAt, now),
          gte(featuredSlots.endsAt, now),
        ),
      )
      .orderBy(asc(featuredSlots.displayOrder), desc(featuredSlots.createdAt)),
    db.select().from(establishmentImages).orderBy(asc(establishmentImages.sortOrder)),
  ]);
  const imageMap = makeImageMap(images);
  return rows.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] }));
}

export async function getPublicEstablishment(slug: string) {
  await enforceExpiredSubscriptions();
  const db = await requireDb();
  const [establishment] = await db
    .select({
      id: establishments.id,
      name: establishments.name,
      slug: establishments.slug,
      description: establishments.description,
      whatsapp: establishments.whatsapp,
      streetAddress: establishments.streetAddress,
      neighborhood: establishments.neighborhood,
      city: establishments.city,
      latitude: establishments.latitude,
      longitude: establishments.longitude,
      isDeliveryOnly: establishments.isDeliveryOnly,
      isDemo: establishments.isDemo,
      logoUrl: establishments.logoUrl,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(establishments)
    .innerJoin(categories, eq(establishments.categoryId, categories.id))
    .where(and(eq(establishments.slug, slug), eq(establishments.isActive, true)))
    .limit(1);
  if (!establishment) return null;
  const images = await db
    .select()
    .from(establishmentImages)
    .where(eq(establishmentImages.establishmentId, establishment.id))
    .orderBy(asc(establishmentImages.sortOrder));
  return { ...establishment, images };
}

export async function getAdminOverview() {
  const db = await requireDb();
  await ensureCommercialPlans();
  const [categoryList, establishmentList, images, planList, subscriptionList, featuredList] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db
      .select({
        id: establishments.id,
        categoryId: establishments.categoryId,
        categoryName: categories.name,
        name: establishments.name,
        slug: establishments.slug,
        description: establishments.description,
        whatsapp: establishments.whatsapp,
        streetAddress: establishments.streetAddress,
        neighborhood: establishments.neighborhood,
        city: establishments.city,
        latitude: establishments.latitude,
        longitude: establishments.longitude,
        isDeliveryOnly: establishments.isDeliveryOnly,
        isActive: establishments.isActive,
        isDemo: establishments.isDemo,
        logoUrl: establishments.logoUrl,
      })
      .from(establishments)
      .innerJoin(categories, eq(establishments.categoryId, categories.id))
      .orderBy(asc(establishments.name)),
    db.select().from(establishmentImages).orderBy(asc(establishmentImages.sortOrder)),
    db.select().from(commercialPlans).orderBy(asc(commercialPlans.id)),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
    db.select().from(featuredSlots).orderBy(desc(featuredSlots.createdAt)),
  ]);
  const imageMap = makeImageMap(images);
  return {
    categories: categoryList,
    establishments: establishmentList.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] })),
    plans: planList,
    subscriptions: subscriptionList,
    featuredSlots: featuredList,
  };
}

export async function createCategory(input: { name: string; slug: string; icon: string }) {
  const db = await requireDb();
  await db.insert(categories).values(input);
}

export async function updateCategory(input: { id: number; name?: string; slug?: string; icon?: string; isActive?: boolean }) {
  const db = await requireDb();
  const { id, ...data } = input;
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await requireDb();
  await db.delete(categories).where(eq(categories.id, id));
}

type EstablishmentInput = {
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  whatsapp: string;
  streetAddress?: string | null;
  neighborhood?: string | null;
  city: string;
  latitude: number;
  longitude: number;
  isDeliveryOnly: boolean;
  isActive: boolean;
  isDemo: boolean;
  logoUrl?: string | null;
  ownerId?: number | null;
  images: { imageUrl: string; altText?: string | null }[];
};

async function replaceEstablishmentImages(establishmentId: number, images: EstablishmentInput["images"]) {
  const db = await requireDb();
  await db.delete(establishmentImages).where(eq(establishmentImages.establishmentId, establishmentId));
  if (images.length) {
    await db.insert(establishmentImages).values(
      images.map((image, index) => ({
        establishmentId,
        imageUrl: image.imageUrl,
        altText: image.altText ?? null,
        sortOrder: index,
      })),
    );
  }
}

export async function createEstablishment(input: EstablishmentInput) {
  const db = await requireDb();
  const { images, ...data } = input;
  await db.insert(establishments).values(data);
  const [created] = await db
    .select({ id: establishments.id })
    .from(establishments)
    .where(eq(establishments.slug, input.slug))
    .limit(1);
  if (created) await replaceEstablishmentImages(created.id, images);
}

export async function updateEstablishment(input: Partial<EstablishmentInput> & { id: number }) {
  const db = await requireDb();
  const { id, images, ...data } = input;
  if (Object.keys(data).length) await db.update(establishments).set(data).where(eq(establishments.id, id));
  if (images) await replaceEstablishmentImages(id, images);
}

export async function deleteEstablishment(id: number) {
  const db = await requireDb();
  await db.delete(establishments).where(eq(establishments.id, id));
}

export async function updateCommercialPlan(input: { id: number; priceCents: number; isActive: boolean }) {
  const db = await requireDb();
  const { id, ...data } = input;
  await db.update(commercialPlans).set(data).where(eq(commercialPlans.id, id));
}

export async function createSubscription(input: {
  establishmentId: number;
  planId: number;
  amountCents: number;
  dueAt: Date;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  paidAt?: Date | null;
  notes?: string | null;
}) {
  const db = await requireDb();
  await db.insert(subscriptions).values(input);
}

export async function updateSubscriptionStatus(input: {
  id: number;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  paidAt?: Date | null;
}) {
  const db = await requireDb();
  const { id, ...data } = input;
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

export async function createFeaturedSlot(input: {
  establishmentId: number;
  planId: number;
  startsAt: Date;
  endsAt: Date;
  displayOrder: number;
}) {
  const db = await requireDb();
  await db.insert(featuredSlots).values({ ...input, isActive: true });
}

export async function updateFeaturedSlotStatus(input: { id: number; isActive: boolean }) {
  const db = await requireDb();
  const { id, ...data } = input;
  await db.update(featuredSlots).set(data).where(eq(featuredSlots.id, id));
}

export async function seedDemoDirectory() {
  const db = await requireDb();
  await ensureCommercialPlans();
  const demoCategories = [
    { name: "Alimentação", slug: "alimentacao", icon: "Utensils" },
    { name: "Mercadinho", slug: "mercadinho", icon: "ShoppingBasket" },
    { name: "Depósito", slug: "deposito", icon: "Package" },
  ];
  await db.insert(categories).values(demoCategories).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const categoryRows = await db.select().from(categories).where(inArray(categories.slug, demoCategories.map(category => category.slug)));
  const categoryId = new Map(categoryRows.map(category => [category.slug, category.id]));
  const demos = [
    { categorySlug: "alimentacao", name: "Maré Alta Surf Café", slug: "mare-alta-surf-cafe", description: "Café de praia demonstrativo com bowls, cafés gelados e o clima leve de uma pausa depois do mar.", whatsapp: "559100000001", streetAddress: "Orla demonstrativa, 25", neighborhood: "Atalaia", city: "Salinópolis", latitude: -0.6064, longitude: -47.3578, isDeliveryOnly: false, isActive: true, isDemo: true, logoUrl: "/manus-storage/mare-alta-surf-cafe-logo_2229b011.png", images: ["/manus-storage/demo-surf-cafe_ebeb5ac6.jpg", "/manus-storage/demo-acai-bowl_07297c78.jpg"] },
    { categorySlug: "alimentacao", name: "Açaí da Vela", slug: "acai-da-vela", description: "Ponto demonstrativo para açaí, frutas e energia para aproveitar a praia até o pôr do sol.", whatsapp: "559100000002", streetAddress: "Rua da Praia, 80", neighborhood: "Maçarico", city: "Salinópolis", latitude: -0.6125, longitude: -47.3521, isDeliveryOnly: true, isActive: true, isDemo: true, logoUrl: "/manus-storage/acai-da-vela-logo_cba03a75.png", images: ["/manus-storage/demo-acai-bowl_07297c78.jpg", "/manus-storage/demo-surf-cafe_ebeb5ac6.jpg"] },
    { categorySlug: "mercadinho", name: "Mercado Pé na Areia", slug: "mercado-pe-na-areia", description: "Mercadinho demonstrativo com itens de conveniência, bebidas geladas e tudo para o fim de semana em Salinas.", whatsapp: "559100000003", streetAddress: "Av. do Farol, 198", neighborhood: "Centro", city: "Salinópolis", latitude: -0.6171, longitude: -47.3496, isDeliveryOnly: false, isActive: true, isDemo: true, logoUrl: "/manus-storage/mercado-pe-na-areia-logo_1f6c37ab.png", images: ["/manus-storage/demo-mercado-praia_ba9c5fef.jpg", "/manus-storage/demo-surf-cafe_ebeb5ac6.jpg"] },
  ];
  for (const demo of demos) {
    const categoryIdValue = categoryId.get(demo.categorySlug);
    if (!categoryIdValue) continue;
    const { categorySlug: _categorySlug, images, ...values } = demo;
    await db.insert(establishments).values({ ...values, categoryId: categoryIdValue }).onDuplicateKeyUpdate({ set: { ...values, categoryId: categoryIdValue, updatedAt: new Date() } });
    const [establishment] = await db.select({ id: establishments.id }).from(establishments).where(eq(establishments.slug, demo.slug)).limit(1);
    if (establishment) await replaceEstablishmentImages(establishment.id, images.map((imageUrl, sortOrder) => ({ imageUrl, altText: `Imagem demonstrativa ${sortOrder + 1} de ${demo.name}` })));
  }
  const seeded = await db.select({ id: establishments.id }).from(establishments).where(inArray(establishments.slug, demos.map(demo => demo.slug)));
  const [featuredPlan] = await db.select().from(commercialPlans).where(eq(commercialPlans.code, "semana")).limit(1);
  if (featuredPlan && seeded[0]) {
    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [existing] = await db.select({ id: featuredSlots.id }).from(featuredSlots).where(and(eq(featuredSlots.establishmentId, seeded[0].id), eq(featuredSlots.planId, featuredPlan.id))).limit(1);
    if (!existing) await db.insert(featuredSlots).values({ establishmentId: seeded[0].id, planId: featuredPlan.id, startsAt: now, endsAt: inThirtyDays, displayOrder: 1, isActive: true });
  }
  return { created: demos.length };
}
