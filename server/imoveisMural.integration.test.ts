import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "./routers";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { ensurePropertyListingPlans } from "./properties";
import type { TrpcContext } from "./_core/context";
import { users } from "../drizzle/schema";
import { propertyListings } from "../drizzle/schema";

const suffix = Date.now();
const userOpenId = `imoveis-mural-user-${suffix}`;
const adminOpenId = `imoveis-mural-admin-${suffix}`;

function context(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterAll(async () => {
  const db = await getDb();
  if (db) await db.delete(users).where(inArray(users.openId, [userOpenId, adminOpenId]));
});

describe("Imóveis no Sal e Mural do Sal", () => {
  it("ativa um imóvel após PIX e modera publicação, curtida e comentário", async () => {
    await ensurePropertyListingPlans();
    await upsertUser({ openId: userOpenId, name: "Anunciante de teste", email: `imoveis-${suffix}@tonosal.local`, role: "user", lastSignedIn: new Date() });
    await upsertUser({ openId: adminOpenId, name: "Admin de teste", email: `mural-admin-${suffix}@tonosal.local`, role: "admin", lastSignedIn: new Date() });
    const user = await getUserByOpenId(userOpenId);
    const admin = await getUserByOpenId(adminOpenId);
    expect(user).toBeDefined();
    expect(admin).toBeDefined();

    const userCaller = appRouter.createCaller(context(user!));
    const adminCaller = appRouter.createCaller(context(admin!));
    const publicCaller = appRouter.createCaller({ ...context(admin!), user: null });
    const weeklyPlan = (await publicCaller.properties.plans()).find(plan => plan.code === "semana")!;
    const created = await userCaller.properties.create({
      title: `Casa para temporada ${suffix}`,
      listingType: "temporada",
      description: "Casa de teste com espaço para uma família aproveitar Salinas em qualquer época do ano.",
      whatsapp: "5591999999999",
      propertyPriceCents: 35000,
      streetAddress: null,
      neighborhood: "Atalaia",
      city: "Salinópolis",
      latitude: null,
      longitude: null,
      bedrooms: 2,
      bathrooms: 1,
      parkingSpaces: 1,
      images: [{ imageUrl: "/uploads/test/property.webp" }],
      planId: weeklyPlan.id,
    });
    expect(created.paymentRequestId).toBeTypeOf("number");
    expect((await publicCaller.properties.list()).some(item => item.id === created.propertyListingId)).toBe(false);
    await userCaller.properties.submitPixProof({ requestId: created.paymentRequestId, pixProofUrl: "/uploads/test/proof.webp" });
    await adminCaller.admin.confirmPropertyPayment({ requestId: created.paymentRequestId, adminNote: "PIX conferido" });
    expect((await publicCaller.properties.list()).some(item => item.id === created.propertyListingId)).toBe(true);
    const db = await getDb();
    await db!.update(propertyListings).set({ activeUntil: new Date(Date.now() - 1000) }).where(eq(propertyListings.id, created.propertyListingId));
    expect((await publicCaller.properties.list()).some(item => item.id === created.propertyListingId)).toBe(false);

    const post = await userCaller.mural.create({ caption: `Pôr do sol de teste em Salinas ${suffix}`, allowsComments: true, locationLabel: "Atalaia", latitude: null, longitude: null, images: ["/uploads/test/mural.webp"] });
    expect((await publicCaller.mural.feed()).some(item => item.id === post.muralPostId)).toBe(false);
    expect((await adminCaller.admin.muralModeration()).posts.some(item => item.id === post.muralPostId)).toBe(true);
    await adminCaller.admin.reviewMuralPost({ id: post.muralPostId, approved: true });
    expect((await publicCaller.mural.feed()).some(item => item.id === post.muralPostId)).toBe(true);
    expect((await userCaller.mural.toggleLike({ muralPostId: post.muralPostId })).liked).toBe(true);
    await userCaller.mural.comment({ muralPostId: post.muralPostId, body: "Que vista bonita!" });
    const pendingComment = (await adminCaller.admin.muralModeration()).comments.find(item => item.muralPostId === post.muralPostId)!;
    await adminCaller.admin.reviewMuralComment({ id: pendingComment.id, approved: true });
    const detail = await userCaller.mural.detail({ id: post.muralPostId });
    expect(detail.comments.some(comment => comment.body === "Que vista bonita!")).toBe(true);
  });
});
