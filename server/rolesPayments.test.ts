import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { categories, establishments, subscriptions, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import { createOwnerPaymentRequest, getDb, getUserByOpenId, upsertUser } from "./db";
import type { TrpcContext } from "./_core/context";

const suffix = Date.now();
const visitorOpenId = `visitor-${suffix}`;
const adminOpenId = `admin-${suffix}`;
const otherOwnerOpenId = `other-owner-${suffix}`;
let visitorId = 0;
let adminId = 0;
let otherOwnerId = 0;
let categoryId = 0;
let establishmentId = 0;

function context(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("perfis, favoritos e confirmação PIX", () => {
  it("permite ao dono cadastrar, solicitar PIX, enviar comprovante e entrar no ar após confirmação", async () => {
    await upsertUser({ openId: visitorOpenId, name: "Parceiro de teste", email: `partner-${suffix}@tonosal.local`, role: "user", lastSignedIn: new Date() });
    await upsertUser({ openId: adminOpenId, name: "Admin de teste", email: `admin-${suffix}@tonosal.local`, role: "admin", lastSignedIn: new Date() });
    const visitor = await getUserByOpenId(visitorOpenId);
    const admin = await getUserByOpenId(adminOpenId);
    expect(visitor).toBeDefined();
    expect(admin).toBeDefined();
    visitorId = visitor!.id;
    adminId = admin!.id;

    const adminCaller = appRouter.createCaller(context(admin!));
    let ownerCaller = appRouter.createCaller(context(visitor!));
    await expect(ownerCaller.owner.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(ownerCaller.admin.paymentRequests()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await ownerCaller.owner.enroll();
    const promotedOwner = await getUserByOpenId(visitorOpenId);
    ownerCaller = appRouter.createCaller(context(promotedOwner!));
    await adminCaller.admin.createCategory({ name: `Categoria PIX ${suffix}`, icon: "Store" });
    const overview = await adminCaller.admin.overview();
    categoryId = overview.categories.find(category => category.name === `Categoria PIX ${suffix}`)!.id;
    const highlightedPlan = overview.plans.find(plan => plan.code === "semana")!;
    const registration = await ownerCaller.owner.completeRegistration({
      categoryId,
      name: `Loja PIX ${suffix}`,
      description: "Estabelecimento usado para validar favoritos, propriedade e confirmação de pagamentos PIX.",
      whatsapp: "5591999999999",
      streetAddress: "Rua de teste, 10",
      neighborhood: "Centro",
      city: "Salinópolis",
      latitude: null,
      longitude: null,
      isDeliveryOnly: false,
      isActive: false,
      isDemo: false,
      images: [],
    });
    const ownerOverview = await ownerCaller.owner.overview();
    const establishment = ownerOverview.establishments.find(item => item.name === `Loja PIX ${suffix}`)!;
    establishmentId = establishment.id;
    expect(establishment.isActive).toBe(false);
    expect(registration.paymentRequestId).toBeTypeOf("number");

    await upsertUser({ openId: otherOwnerOpenId, name: "Outro parceiro", email: `other-${suffix}@tonosal.local`, role: "user", lastSignedIn: new Date() });
    let otherOwner = await getUserByOpenId(otherOwnerOpenId);
    let otherOwnerCaller = appRouter.createCaller(context(otherOwner!));
    await otherOwnerCaller.owner.enroll();
    otherOwner = await getUserByOpenId(otherOwnerOpenId);
    otherOwnerId = otherOwner!.id;
    otherOwnerCaller = appRouter.createCaller(context(otherOwner!));
    await expect(otherOwnerCaller.owner.updateEstablishment({ id: establishmentId, name: "Tentativa indevida" })).rejects.toThrow("Você não pode editar este estabelecimento.");

    let paymentRequest = (await ownerCaller.owner.overview()).paymentRequests.find(item => item.establishmentId === establishmentId)!;
    expect(paymentRequest.status).toBe("aguardando_pagamento");
    expect(paymentRequest.id).toBe(registration.paymentRequestId);

    await ownerCaller.owner.submitPixProof({ requestId: paymentRequest.id, pixProofUrl: "https://example.com/comprovante.png" });
    paymentRequest = (await ownerCaller.owner.overview()).paymentRequests.find(item => item.id === paymentRequest.id)!;
    expect(paymentRequest.status).toBe("em_analise");

    await adminCaller.admin.confirmPaymentRequest({ requestId: paymentRequest.id, adminNote: "Comprovante conferido." });
    const publicCaller = appRouter.createCaller({ ...context(admin!), user: null });
    expect((await publicCaller.directory.list()).some(item => item.id === establishmentId)).toBe(true);

    await expect(createOwnerPaymentRequest({ establishmentId, planId: paymentRequest.planId, purpose: "assinatura" }, visitorId)).rejects.toThrow("A mensalidade é gerada automaticamente");
    await ownerCaller.owner.requestHighlight({ establishmentId, planId: highlightedPlan.id, startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), ownerNote: "Quero aparecer em destaque." });
    let highlightRequest = (await ownerCaller.owner.overview()).paymentRequests.find(item => item.establishmentId === establishmentId && item.purpose === "destaque")!;
    expect(highlightRequest.status).toBe("aguardando_pagamento");
    await ownerCaller.owner.submitPixProof({ requestId: highlightRequest.id, pixProofUrl: "https://example.com/comprovante-destaque.png" });
    highlightRequest = (await ownerCaller.owner.overview()).paymentRequests.find(item => item.id === highlightRequest.id)!;
    expect(highlightRequest.status).toBe("em_analise");
    await adminCaller.admin.confirmPaymentRequest({ requestId: highlightRequest.id, adminNote: "Destaque confirmado." });
    expect((await adminCaller.admin.overview()).featuredSlots.some(slot => slot.establishmentId === establishmentId && slot.planId === highlightedPlan.id && slot.isActive)).toBe(true);

    await ownerCaller.account.addFavorite({ establishmentId });
    expect(await ownerCaller.account.favoriteIds()).toContain(establishmentId);
    await ownerCaller.account.removeFavorite({ establishmentId });
    expect(await ownerCaller.account.favoriteIds()).not.toContain(establishmentId);
  });

  it("gera renovação antes do vencimento e suspende estabelecimento não demonstrativo somente após o prazo", async () => {
    const db = await getDb();
    const [subscription] = await db!.select().from(subscriptions).where(eq(subscriptions.establishmentId, establishmentId)).limit(1);
    expect(subscription).toBeDefined();
    await db!.update(subscriptions).set({ dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), status: "pago" }).where(eq(subscriptions.id, subscription!.id));
    const publicCaller = appRouter.createCaller({ ...context((await getUserByOpenId(adminOpenId))!), user: null });
    expect((await publicCaller.directory.list()).some(item => item.id === establishmentId)).toBe(true);
    const renewedOwner = await getUserByOpenId(visitorOpenId);
    let renewalRequests = (await appRouter.createCaller(context(renewedOwner!)).owner.overview()).paymentRequests.filter(item => item.establishmentId === establishmentId && item.purpose === "assinatura" && item.status === "aguardando_pagamento");
    expect(renewalRequests).toHaveLength(1);

    const ownerCaller = appRouter.createCaller(context(renewedOwner!));
    const adminCaller = appRouter.createCaller(context((await getUserByOpenId(adminOpenId))!));
    await ownerCaller.owner.submitPixProof({ requestId: renewalRequests[0].id, pixProofUrl: "https://example.com/comprovante-renovacao.png" });
    await adminCaller.admin.confirmPaymentRequest({ requestId: renewalRequests[0].id, adminNote: "Renovação confirmada." });
    const allSubscriptions = await db!.select().from(subscriptions).where(eq(subscriptions.establishmentId, establishmentId));
    const renewedSubscription = allSubscriptions.find(item => item.id !== subscription!.id);
    expect(renewedSubscription).toBeDefined();
    expect(renewedSubscription!.dueAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000);
    expect((await publicCaller.directory.list()).some(item => item.id === establishmentId)).toBe(true);

    await db!.update(subscriptions).set({ dueAt: new Date(Date.now() - 60_000), status: "pago" }).where(eq(subscriptions.establishmentId, establishmentId));
    expect((await publicCaller.directory.list()).some(item => item.id === establishmentId)).toBe(false);
    const updated = await db!.select().from(subscriptions).where(eq(subscriptions.establishmentId, establishmentId));
    expect(updated.some(item => item.status === "atrasado")).toBe(true);
    renewalRequests = (await appRouter.createCaller(context(renewedOwner!)).owner.overview()).paymentRequests.filter(item => item.establishmentId === establishmentId && item.purpose === "assinatura" && item.status === "aguardando_pagamento");
    expect(renewalRequests).toHaveLength(1);
  });
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (establishmentId) await db.delete(establishments).where(eq(establishments.id, establishmentId));
  if (categoryId) await db.delete(categories).where(eq(categories.id, categoryId));
  if (visitorId) await db.delete(users).where(eq(users.id, visitorId));
  if (adminId) await db.delete(users).where(eq(users.id, adminId));
  if (otherOwnerId) await db.delete(users).where(eq(users.id, otherOwnerId));
});
