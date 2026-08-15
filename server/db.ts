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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return result[0];
}

export async function createLocalUser(input: { openId: string; name: string; email: string; passwordHash: string }) {
  const db = await requireDb();
  const email = input.email.trim().toLowerCase();
  await db.insert(users).values({
    openId: input.openId,
    name: input.name.trim(),
    email,
    passwordHash: input.passwordHash,
    loginMethod: "local",
    role: "user",
    lastSignedIn: new Date(),
  });
  const user = await getUserByEmail(email);
  if (!user) throw new Error("Não foi possível criar a conta local.");
  return user;
}

export async function recordLocalSignIn(userId: number) {
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
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
  return settings ?? { id: 1, pixKey: null, recipientName: null, instructions: null, dailyHighlightCapacity: 5 };
}

export async function updatePaymentSettings(input: { pixKey?: string | null; recipientName?: string | null; instructions?: string | null; dailyHighlightCapacity?: number; updatedByUserId: number }) {
  const db = await requireDb();
  await db.insert(paymentSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
}

export async function enforceExpiredSubscriptions(now = new Date()) {
  const db = await requireDb();
  const renewalLeadAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const rows = await db.select({ subscription: subscriptions }).from(subscriptions).innerJoin(commercialPlans, eq(subscriptions.planId, commercialPlans.id)).where(eq(commercialPlans.code, "basico")).orderBy(desc(subscriptions.createdAt));
  const latestByEstablishment = new Map<number, typeof rows[number]["subscription"]>();
  for (const row of rows) if (!latestByEstablishment.has(row.subscription.establishmentId)) latestByEstablishment.set(row.subscription.establishmentId, row.subscription);
  const renewed: number[] = [];
  const activeOrPending = Array.from(latestByEstablishment.values()).filter(subscription => subscription.dueAt <= renewalLeadAt && (subscription.status === "pago" || subscription.status === "pendente"));
  for (const subscription of activeOrPending) {
    const [existingRenewal] = await db.select({ id: paymentRequests.id }).from(paymentRequests).where(and(eq(paymentRequests.establishmentId, subscription.establishmentId), eq(paymentRequests.purpose, "assinatura"), inArray(paymentRequests.status, ["aguardando_pagamento", "em_analise"]))).limit(1);
    if (existingRenewal) continue;
    const [plan] = await db.select().from(commercialPlans).where(eq(commercialPlans.id, subscription.planId)).limit(1);
    const [establishment] = await db.select({ ownerId: establishments.ownerId }).from(establishments).where(eq(establishments.id, subscription.establishmentId)).limit(1);
    if (plan && establishment?.ownerId) {
      await db.insert(paymentRequests).values({ establishmentId: subscription.establishmentId, planId: subscription.planId, purpose: "assinatura", requestedByUserId: establishment.ownerId, amountCents: plan.priceCents, status: "aguardando_pagamento", ownerNote: "Renovação mensal gerada automaticamente. Envie o comprovante até a data de vencimento para manter o estabelecimento ativo." });
      renewed.push(subscription.establishmentId);
    }
  }
  const overdue = Array.from(latestByEstablishment.values()).filter(subscription => subscription.dueAt <= now && (subscription.status === "pago" || subscription.status === "pendente"));
  for (const subscription of overdue) {
    await db.update(subscriptions).set({ status: "atrasado" }).where(eq(subscriptions.id, subscription.id));
    await db.update(establishments).set({ isActive: false }).where(and(eq(establishments.id, subscription.establishmentId), eq(establishments.isDemo, false)));
  }
  return { renewalCreated: renewed, suspended: overdue.map(subscription => subscription.establishmentId) };
}

export async function createOwnedEstablishment(input: EstablishmentInput, ownerId: number) {
  await promoteUserToOwner(ownerId);
  return createEstablishment({ ...input, ownerId, isActive: false, isDemo: false });
}

export async function completeOwnerRegistration(input: EstablishmentInput, ownerId: number) {
  await ensureCommercialPlans();
  const db = await requireDb();
  const [basicPlan] = await db.select().from(commercialPlans).where(and(eq(commercialPlans.code, "basico"), eq(commercialPlans.isActive, true))).limit(1);
  if (!basicPlan) throw new Error("O plano básico não está disponível no momento.");
  const establishmentId = await createOwnedEstablishment(input, ownerId);
  if (!establishmentId) throw new Error("Não foi possível criar o estabelecimento.");
  await db.insert(paymentRequests).values({
    establishmentId,
    planId: basicPlan.id,
    purpose: "assinatura",
    requestedByUserId: ownerId,
    amountCents: basicPlan.priceCents,
    status: "aguardando_pagamento",
    ownerNote: "Solicitação inicial criada automaticamente ao concluir o cadastro.",
  });
  const [request] = await db.select({ id: paymentRequests.id }).from(paymentRequests).where(and(eq(paymentRequests.establishmentId, establishmentId), eq(paymentRequests.requestedByUserId, ownerId))).orderBy(desc(paymentRequests.createdAt)).limit(1);
  return { establishmentId, paymentRequestId: request?.id ?? null, amountCents: basicPlan.priceCents };
}

export async function updateOwnedEstablishment(input: Partial<EstablishmentInput> & { id: number }, ownerId: number) {
  if (!(await isOwnedByUser(input.id, ownerId))) throw new Error("Você não pode editar este estabelecimento.");
  const { isActive: _isActive, isDemo: _isDemo, ...safeInput } = input;
  await updateEstablishment(safeInput);
}

export async function getOwnerOverview(ownerId: number) {
  const db = await requireDb();
  const [establishmentRows, images, planRows, requestRows, subscriptionRows, settings] = await Promise.all([
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
    db.select({ establishmentId: subscriptions.establishmentId, dueAt: subscriptions.dueAt, status: subscriptions.status }).from(subscriptions).innerJoin(establishments, eq(subscriptions.establishmentId, establishments.id)).innerJoin(commercialPlans, eq(subscriptions.planId, commercialPlans.id)).where(and(eq(establishments.ownerId, ownerId), eq(commercialPlans.code, "basico"))).orderBy(desc(subscriptions.createdAt)),
    getPaymentSettings(),
  ]);
  const imageMap = makeImageMap(images);
  return {
    establishments: establishmentRows.map(row => ({ ...row, images: imageMap.get(row.id) ?? [] })),
    plans: planRows,
    paymentRequests: requestRows,
    monthlySubscriptions: subscriptionRows,
    paymentSettings: settings,
  };
}

export async function createOwnerPaymentRequest(input: { establishmentId: number; planId: number; purpose: PaymentPurpose; ownerNote?: string | null }, ownerId: number) {
  if (!(await isOwnedByUser(input.establishmentId, ownerId))) throw new Error("Você não pode solicitar pagamento para este estabelecimento.");
  const db = await requireDb();
  const [plan] = await db.select().from(commercialPlans).where(and(eq(commercialPlans.id, input.planId), eq(commercialPlans.isActive, true))).limit(1);
  if (!plan) throw new Error("Plano indisponível.");
  if (input.purpose !== "destaque") throw new Error("A mensalidade é gerada automaticamente no cadastro e na renovação.");
  if (plan.code === "basico") throw new Error("Escolha um plano de destaque.");
  await db.insert(paymentRequests).values({ ...input, requestedByUserId: ownerId, amountCents: plan.priceCents, status: "aguardando_pagamento" });
}

export async function getHighlightAvailability(input: { planId: number; startsAt?: Date; days?: number }) {
  const db = await requireDb();
  const startsAt = new Date(input.startsAt ?? new Date());
  startsAt.setHours(0, 0, 0, 0);
  const rangeDays = Math.min(Math.max(input.days ?? 14, 1), 31);
  const [plan, settings] = await Promise.all([
    db.select().from(commercialPlans).where(and(eq(commercialPlans.id, input.planId), eq(commercialPlans.isActive, true))).limit(1),
    getPaymentSettings(),
  ]).then(([plans, paymentSettings]) => [plans[0], paymentSettings] as const);
  if (!plan || plan.code === "basico") throw new Error("Escolha um plano de Destaque disponível.");

  const durationDays = plan.durationDays ?? 1;
  const finalStart = new Date(startsAt.getTime() + (rangeDays - 1) * 24 * 60 * 60 * 1000);
  const rangeEndsAt = new Date(finalStart.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
  const [slots, pending] = await Promise.all([
    db.select().from(featuredSlots).where(and(eq(featuredSlots.isActive, true), lte(featuredSlots.startsAt, rangeEndsAt), gte(featuredSlots.endsAt, startsAt))),
    db.select().from(paymentRequests).where(and(eq(paymentRequests.purpose, "destaque"), inArray(paymentRequests.status, ["aguardando_pagamento", "em_analise"]), lte(paymentRequests.scheduledStartsAt, rangeEndsAt), gte(paymentRequests.scheduledEndsAt, startsAt))),
  ]);
  const dailyHighlightCapacity = settings.dailyHighlightCapacity;
  const days = Array.from({ length: rangeDays }, (_, index) => {
    const date = new Date(startsAt.getTime() + index * 24 * 60 * 60 * 1000);
    const endsAt = new Date(date.getTime() + (durationDays - 1) * 24 * 60 * 60 * 1000);
    let availableSlots = dailyHighlightCapacity;
    for (let day = new Date(date); day <= endsAt; day = new Date(day.getTime() + 24 * 60 * 60 * 1000)) {
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const booked = slots.filter(slot => slot.startsAt <= dayEnd && slot.endsAt >= day).length + pending.filter(request => request.scheduledStartsAt && request.scheduledEndsAt && request.scheduledStartsAt <= dayEnd && request.scheduledEndsAt >= day).length;
      availableSlots = Math.min(availableSlots, Math.max(dailyHighlightCapacity - booked, 0));
    }
    return { date: date.toISOString().slice(0, 10), endsAt: endsAt.toISOString().slice(0, 10), availableSlots, isAvailable: availableSlots > 0 };
  });
  return { durationDays, priceCents: plan.priceCents, dailyHighlightCapacity, days };
}

export async function createOwnerHighlightPaymentRequest(input: { establishmentId: number; planId: number; startsAt: Date; ownerNote?: string | null }, ownerId: number) {
  if (!(await isOwnedByUser(input.establishmentId, ownerId))) throw new Error("Você não pode solicitar pagamento para este estabelecimento.");
  const db = await requireDb();
  const startsAt = new Date(input.startsAt);
  startsAt.setHours(0, 0, 0, 0);
  if (startsAt < new Date(new Date().setHours(0, 0, 0, 0))) throw new Error("Escolha uma data futura para o Destaque.");
  const availability = await getHighlightAvailability({ planId: input.planId, startsAt, days: 1 });
  if (!availability.days[0]?.isAvailable) throw new Error("Não há mais vagas de Destaque disponíveis para todo esse período.");
  const endsAt = new Date(startsAt.getTime() + (availability.durationDays - 1) * 24 * 60 * 60 * 1000);
  await db.insert(paymentRequests).values({ establishmentId: input.establishmentId, planId: input.planId, purpose: "destaque", requestedByUserId: ownerId, amountCents: availability.priceCents, status: "aguardando_pagamento", ownerNote: input.ownerNote ?? null, scheduledStartsAt: startsAt, scheduledEndsAt: endsAt });
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
    const startsAt = request.scheduledStartsAt ?? now;
    const endsAt = request.scheduledEndsAt ?? new Date(startsAt.getTime() + (plan.durationDays ?? 1) * 24 * 60 * 60 * 1000);
    await db.insert(featuredSlots).values({ establishmentId: request.establishmentId, planId: request.planId, startsAt, endsAt, displayOrder: input.displayOrder ?? 0, isActive: true });
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
  latitude?: number | null;
  longitude?: number | null;
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
  return created?.id ?? null;
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
    { categorySlug: "alimentacao", name: "Maré Alta Surf Café", slug: "mare-alta-surf-cafe", description: "Café de praia demonstrativo com bowls, cafés gelados e o clima leve de uma pausa depois do mar.", whatsapp: "559100000001", streetAddress: "Orla demonstrativa, 25", neighborhood: "Atalaia", city: "Salinópolis", latitude: -0.6064, longitude: -47.3578, isDeliveryOnly: false, isActive: true, isDemo: true, logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/SFtwqntsHGgJXuLb.png", images: ["https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/hAbGMdalFNTqHPhq.jpg", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/tgmdEMAqWHHNgAP.jpg"] },
    { categorySlug: "alimentacao", name: "Açaí da Vela", slug: "acai-da-vela", description: "Ponto demonstrativo para açaí, frutas e energia para aproveitar a praia até o pôr do sol.", whatsapp: "559100000002", streetAddress: "Rua da Praia, 80", neighborhood: "Maçarico", city: "Salinópolis", latitude: -0.6125, longitude: -47.3521, isDeliveryOnly: true, isActive: true, isDemo: true, logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/bGkylAZagQKBEJzi.png", images: ["https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/tgmdEMAqWHHNgAP.jpg", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/hAbGMdalFNTqHPhq.jpg"] },
    { categorySlug: "mercadinho", name: "Mercado Pé na Areia", slug: "mercado-pe-na-areia", description: "Mercadinho demonstrativo com itens de conveniência, bebidas geladas e tudo para o fim de semana em Salinas.", whatsapp: "559100000003", streetAddress: "Av. do Farol, 198", neighborhood: "Centro", city: "Salinópolis", latitude: -0.6171, longitude: -47.3496, isDeliveryOnly: false, isActive: true, isDemo: true, logoUrl: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/RCMsGhXvLwOlXGay.png", images: ["https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/vtWWUHiwjyCOqWyQ.jpg", "https://files.manuscdn.com/user_upload_by_module/session_file/310519663167288181/hAbGMdalFNTqHPhq.jpg"] },
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

export function shouldBootstrapDemoDirectory(establishmentCount: number) {
  return establishmentCount === 0;
}

export async function bootstrapDemoDirectoryIfEmpty() {
  if (process.env.SEED_DEMO_DIRECTORY === "false") {
    return { seeded: false, reason: "disabled" as const };
  }

  const db = await requireDb();
  const existing = await db.select({ id: establishments.id }).from(establishments).limit(1);
  if (!shouldBootstrapDemoDirectory(existing.length)) {
    return { seeded: false, reason: "existing-establishments" as const };
  }

  await seedDemoDirectory();
  return { seeded: true, reason: "empty-directory" as const };
}
