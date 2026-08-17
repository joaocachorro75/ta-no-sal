import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { propertyListingImages, propertyListingPlans, propertyListings, propertyPaymentRequests, users } from "../drizzle/schema";
import { requireDb } from "./db";

export type PropertyListingInput = {
  title: string;
  slug: string;
  listingType: "aluguel_fixo" | "temporada" | "venda";
  description: string;
  whatsapp: string;
  propertyPriceCents?: number | null;
  streetAddress?: string | null;
  neighborhood?: string | null;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  images: { imageUrl: string; altText?: string | null }[];
  planId: number;
};

const defaultPlans = [
  { code: "semana" as const, label: "Anúncio semanal", priceCents: 0, durationDays: 7 },
  { code: "mes" as const, label: "Anúncio mensal", priceCents: 0, durationDays: 30 },
];

export async function ensurePropertyListingPlans() {
  const db = await requireDb();
  for (const plan of defaultPlans) {
    await db.insert(propertyListingPlans).values({ ...plan, isActive: true }).onDuplicateKeyUpdate({ set: { label: plan.label, durationDays: plan.durationDays } });
  }
}

export async function getPropertyPlans() {
  const db = await requireDb();
  return db.select().from(propertyListingPlans).orderBy(propertyListingPlans.durationDays);
}

async function imagesByPropertyIds(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return new Map<number, { id: number; imageUrl: string; altText: string | null; sortOrder: number }[]>();
  const images = await db.select().from(propertyListingImages).where(inArray(propertyListingImages.propertyListingId, ids)).orderBy(propertyListingImages.sortOrder);
  return images.reduce((map, image) => {
    const current = map.get(image.propertyListingId) ?? [];
    current.push(image);
    map.set(image.propertyListingId, current);
    return map;
  }, new Map<number, typeof images>());
}

async function hydratePropertyRows<T extends { id: number }>(rows: T[]) {
  const images = await imagesByPropertyIds(rows.map(row => row.id));
  return rows.map(row => ({ ...row, images: images.get(row.id) ?? [] }));
}

export async function getPublicProperties(type?: PropertyListingInput["listingType"]) {
  const db = await requireDb();
  const activeNow = gte(propertyListings.activeUntil, new Date());
  const rows = await db.select().from(propertyListings).where(type ? and(eq(propertyListings.status, "ativo"), activeNow, eq(propertyListings.listingType, type)) : and(eq(propertyListings.status, "ativo"), activeNow)).orderBy(desc(propertyListings.createdAt));
  return hydratePropertyRows(rows);
}

export async function getPublicProperty(slug: string) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: propertyListings.id, slug: propertyListings.slug, title: propertyListings.title, listingType: propertyListings.listingType,
      description: propertyListings.description, whatsapp: propertyListings.whatsapp, propertyPriceCents: propertyListings.propertyPriceCents,
      streetAddress: propertyListings.streetAddress, neighborhood: propertyListings.neighborhood, city: propertyListings.city,
      bedrooms: propertyListings.bedrooms, bathrooms: propertyListings.bathrooms, parkingSpaces: propertyListings.parkingSpaces,
      latitude: propertyListings.latitude, longitude: propertyListings.longitude, activeUntil: propertyListings.activeUntil, authorName: users.name,
    })
    .from(propertyListings)
    .leftJoin(users, eq(propertyListings.userId, users.id))
    .where(and(eq(propertyListings.slug, slug), eq(propertyListings.status, "ativo"), gte(propertyListings.activeUntil, new Date())))
    .limit(1);
  if (!rows[0]) return undefined;
  return (await hydratePropertyRows(rows))[0];
}

export async function createPropertyListing(userId: number, input: PropertyListingInput) {
  const db = await requireDb();
  const plan = await db.select().from(propertyListingPlans).where(and(eq(propertyListingPlans.id, input.planId), eq(propertyListingPlans.isActive, true))).limit(1);
  if (!plan[0]) throw new Error("Plano de anúncio indisponível.");
  const result = await db.insert(propertyListings).values({
    userId, planId: plan[0].id, title: input.title, slug: input.slug, listingType: input.listingType, description: input.description,
    whatsapp: input.whatsapp, propertyPriceCents: input.propertyPriceCents ?? null, streetAddress: input.streetAddress ?? null,
    neighborhood: input.neighborhood ?? null, city: input.city, latitude: input.latitude ?? null, longitude: input.longitude ?? null,
    bedrooms: input.bedrooms ?? null, bathrooms: input.bathrooms ?? null, parkingSpaces: input.parkingSpaces ?? null,
  });
  const propertyListingId = Number(result[0].insertId);
  if (input.images.length) await db.insert(propertyListingImages).values(input.images.map((image, sortOrder) => ({ propertyListingId, imageUrl: image.imageUrl, altText: image.altText ?? null, sortOrder })));
  const payment = await db.insert(propertyPaymentRequests).values({ propertyListingId, requestedByUserId: userId, planId: plan[0].id, amountCents: plan[0].priceCents });
  return { propertyListingId, paymentRequestId: Number(payment[0].insertId), plan: plan[0] };
}

export async function getMyPropertyListings(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(propertyListings).where(eq(propertyListings.userId, userId)).orderBy(desc(propertyListings.createdAt));
  const hydrated = await hydratePropertyRows(rows);
  const requests = await db.select().from(propertyPaymentRequests).where(inArray(propertyPaymentRequests.propertyListingId, rows.map(row => row.id).length ? rows.map(row => row.id) : [-1])).orderBy(desc(propertyPaymentRequests.createdAt));
  return hydrated.map(property => ({ ...property, paymentRequests: requests.filter(request => request.propertyListingId === property.id) }));
}

export async function submitPropertyPixProof(userId: number, input: { requestId: number; pixProofUrl: string; ownerNote?: string | null }) {
  const db = await requireDb();
  const requests = await db.select().from(propertyPaymentRequests).where(eq(propertyPaymentRequests.id, input.requestId)).limit(1);
  const request = requests[0];
  if (!request || request.requestedByUserId !== userId) throw new Error("Solicitação de pagamento não encontrada.");
  if (request.status !== "aguardando_pagamento" && request.status !== "recusado") throw new Error("Este pagamento não aceita comprovante agora.");
  await db.update(propertyPaymentRequests).set({ status: "em_analise", pixProofUrl: input.pixProofUrl, ownerNote: input.ownerNote ?? null }).where(eq(propertyPaymentRequests.id, input.requestId));
  await db.update(propertyListings).set({ status: "em_analise" }).where(eq(propertyListings.id, request.propertyListingId));
  return { success: true };
}

export async function getAdminPropertyOverview() {
  const db = await requireDb();
  const plans = await getPropertyPlans();
  const propertyRows = await db.select({ property: propertyListings, ownerName: users.name, ownerEmail: users.email }).from(propertyListings).leftJoin(users, eq(propertyListings.userId, users.id)).orderBy(desc(propertyListings.createdAt));
  const properties = await hydratePropertyRows(propertyRows.map(row => ({ ...row.property, ownerName: row.ownerName, ownerEmail: row.ownerEmail })));
  const requestRows = await db.select({ request: propertyPaymentRequests, propertyTitle: propertyListings.title, requesterName: users.name }).from(propertyPaymentRequests).leftJoin(propertyListings, eq(propertyPaymentRequests.propertyListingId, propertyListings.id)).leftJoin(users, eq(propertyPaymentRequests.requestedByUserId, users.id)).orderBy(desc(propertyPaymentRequests.createdAt));
  return { plans, properties, requests: requestRows.map(row => ({ ...row.request, propertyTitle: row.propertyTitle, requesterName: row.requesterName })) };
}

export async function updatePropertyPlan(input: { id: number; label: string; priceCents: number; isActive: boolean }) {
  const db = await requireDb();
  await db.update(propertyListingPlans).set({ label: input.label, priceCents: input.priceCents, isActive: input.isActive }).where(eq(propertyListingPlans.id, input.id));
  return { success: true };
}

export async function confirmPropertyPayment(requestId: number, adminId: number, adminNote?: string | null) {
  const db = await requireDb();
  const rows = await db.select({ request: propertyPaymentRequests, plan: propertyListingPlans }).from(propertyPaymentRequests).innerJoin(propertyListingPlans, eq(propertyPaymentRequests.planId, propertyListingPlans.id)).where(eq(propertyPaymentRequests.id, requestId)).limit(1);
  const row = rows[0];
  if (!row || row.request.status !== "em_analise") throw new Error("Solicitação PIX indisponível para confirmação.");
  const activeUntil = new Date(Date.now() + row.plan.durationDays * 24 * 60 * 60 * 1000);
  await db.update(propertyPaymentRequests).set({ status: "confirmado", confirmedByUserId: adminId, confirmedAt: new Date(), adminNote: adminNote ?? null }).where(eq(propertyPaymentRequests.id, requestId));
  await db.update(propertyListings).set({ status: "ativo", planId: row.plan.id, activeUntil }).where(eq(propertyListings.id, row.request.propertyListingId));
  return { success: true, activeUntil };
}

export async function rejectPropertyPayment(requestId: number, adminId: number, adminNote?: string | null) {
  const db = await requireDb();
  const rows = await db.select().from(propertyPaymentRequests).where(eq(propertyPaymentRequests.id, requestId)).limit(1);
  const request = rows[0];
  if (!request || request.status !== "em_analise") throw new Error("Solicitação PIX indisponível para recusa.");
  await db.update(propertyPaymentRequests).set({ status: "recusado", confirmedByUserId: adminId, confirmedAt: new Date(), adminNote: adminNote ?? null }).where(eq(propertyPaymentRequests.id, requestId));
  await db.update(propertyListings).set({ status: "pendente_pagamento" }).where(eq(propertyListings.id, request.propertyListingId));
  return { success: true };
}

export async function expirePropertyListings() {
  const db = await requireDb();
  const result = await db.update(propertyListings).set({ status: "inativo" }).where(and(eq(propertyListings.status, "ativo"), lt(propertyListings.activeUntil, new Date())));
  return { affectedRows: result[0].affectedRows };
}
