import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { seedDemoDirectory } from "./db";
import type { TrpcContext } from "./_core/context";

const suffix = Date.now();
const categoryName = `Categoria de teste ${suffix}`;
const establishmentName = `Parceiro demo de teste ${suffix}`;
let categoryId: number | null = null;
let establishmentId: number | null = null;
let featuredSlotId: number | null = null;

function createAdminContext(): TrpcContext {
  const now = new Date();
  return {
    user: { id: 0, openId: "test-admin", name: "Administrador de teste", email: "test@tonosal.local", loginMethod: "test", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("operações administrativas", () => {
  const caller = appRouter.createCaller(createAdminContext());

  it("administra categoria, parceiro, planos e destaques sem lançar mensalidades manualmente", async () => {
    await caller.admin.createCategory({ name: categoryName, icon: "Store" });
    let overview = await caller.admin.overview();
    const category = overview.categories.find(item => item.name === categoryName);
    expect(category).toBeDefined();
    categoryId = category!.id;

    await caller.admin.updateCategory({ id: categoryId, name: `${categoryName} atualizada`, isActive: true });
    overview = await caller.admin.overview();
    const updatedCategory = overview.categories.find(item => item.id === categoryId);
    expect(updatedCategory?.name).toContain("atualizada");

    await caller.admin.createEstablishment({
      categoryId,
      name: establishmentName,
      description: "Parceiro usado exclusivamente para validar as operações administrativas do Tô no Sal.",
      whatsapp: "5591999999999",
      streetAddress: "Endereço de teste",
      neighborhood: "Atalaia",
      city: "Salinópolis",
      latitude: -0.61,
      longitude: -47.35,
      isDeliveryOnly: false,
      isActive: true,
      isDemo: true,
      logoUrl: "https://example.com/logo-teste.png",
      images: [],
    });
    overview = await caller.admin.overview();
    const establishment = overview.establishments.find(item => item.name === establishmentName);
    expect(establishment).toBeDefined();
    expect(establishment?.logoUrl).toBe("https://example.com/logo-teste.png");
    establishmentId = establishment!.id;

    await caller.admin.updateEstablishment({ id: establishmentId, isActive: false, logoUrl: "https://example.com/logo-atualizada.png" });
    overview = await caller.admin.overview();
    expect(overview.establishments.find(item => item.id === establishmentId)?.isActive).toBe(false);
    expect(overview.establishments.find(item => item.id === establishmentId)?.logoUrl).toBe("https://example.com/logo-atualizada.png");
    await caller.admin.updateEstablishment({ id: establishmentId, isActive: true });

    const publicCaller = appRouter.createCaller({ ...createAdminContext(), user: null });
    const publicDirectory = await publicCaller.directory.list();
    expect(publicDirectory.find(item => item.id === establishmentId)?.logoUrl).toBe("https://example.com/logo-atualizada.png");

    const basicPlan = overview.plans.find(plan => plan.code === "basico")!;
    const highlightedPlan = overview.plans.find(plan => plan.code === "semana")!;
    await caller.admin.updatePlan({ id: basicPlan.id, priceCents: basicPlan.priceCents + 1, isActive: true });
    await caller.admin.updatePlan({ id: basicPlan.id, priceCents: basicPlan.priceCents, isActive: basicPlan.isActive });

    expect("createSubscription" in (caller.admin as object)).toBe(false);
    expect("updateSubscriptionStatus" in (caller.admin as object)).toBe(false);

    await caller.admin.createFeaturedSlot({ establishmentId, planId: highlightedPlan.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86400000), displayOrder: 99 });
    overview = await caller.admin.overview();
    const featured = overview.featuredSlots.find(item => item.establishmentId === establishmentId && item.displayOrder === 99);
    expect(featured).toBeDefined();
    featuredSlotId = featured!.id;
    await caller.admin.updateFeaturedSlotStatus({ id: featuredSlotId, isActive: false });
  });

  it("mantém logomarcas nos parceiros demonstrativos do catálogo público", async () => {
    await seedDemoDirectory();
    const publicCaller = appRouter.createCaller({ ...createAdminContext(), user: null });
    const publicDirectory = await publicCaller.directory.list();
    const demoPartners = publicDirectory.filter(item => item.isDemo);

    expect(demoPartners).toHaveLength(3);
    expect(demoPartners.every(item => item.logoUrl?.startsWith("/uploads/system/demo-assets/"))).toBe(true);
    expect(demoPartners.every(item => item.images[0]?.startsWith("/uploads/system/demo-assets/") && item.images[0].endsWith(".webp"))).toBe(true);
  });
});

afterAll(async () => {
  const caller = appRouter.createCaller(createAdminContext());
  if (establishmentId) await caller.admin.deleteEstablishment({ id: establishmentId });
  if (categoryId) await caller.admin.deleteCategory({ id: categoryId });
});
