import { and, asc, desc, eq, gte, like, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  commercialPlans,
  establishmentImages,
  establishments,
  featuredSlots,
  InsertUser,
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

export async function ensureCommercialPlans() {
  const db = await requireDb();
  await db.insert(commercialPlans).values([
    { code: "basico", label: "básico", priceCents: 0, durationDays: null },
    { code: "dia", label: "dia", priceCents: 0, durationDays: 1 },
    { code: "semana", label: "semana", priceCents: 0, durationDays: 7 },
    { code: "mes", label: "mês", priceCents: 0, durationDays: 30 },
  ]).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
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
