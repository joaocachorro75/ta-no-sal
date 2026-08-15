import { COOKIE_NAME } from "@shared/const";
import { createSlug } from "@shared/directory";
import { TRPCError } from "@trpc/server";
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, ownerProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { saveEstablishmentImage } from "./appStorage";
import { getBeachConditions } from "./beachConditions";

const imageSchema = z.object({
  imageUrl: z.string().url(),
  altText: z.string().max(180).optional().nullable(),
});

const establishmentSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).optional(),
  description: z.string().trim().min(12).max(4000),
  whatsapp: z.string().trim().min(8).max(32),
  streetAddress: z.string().trim().max(255).optional().nullable(),
  neighborhood: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2).max(120).default("Salinópolis"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isDeliveryOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isDemo: z.boolean().default(false),
  logoUrl: z.string().url().max(1024).optional().nullable(),
  images: z.array(imageSchema).max(6).default([]),
});

const statusSchema = z.enum(["pendente", "pago", "atrasado", "cancelado"]);
const paymentPurposeSchema = z.enum(["assinatura", "destaque"]);

function secureEquals(left: string, right: string) {
  const leftValue = Buffer.from(left);
  const rightValue = Buffer.from(right);
  return leftValue.length === rightValue.length && timingSafeEqual(leftValue, rightValue);
}

function localAdminSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A chave de sessão do administrador não foi configurada." });
  return new TextEncoder().encode(secret);
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  adminAccess: router({
    me: publicProcedure.query(({ ctx }) => ({ isAdmin: ctx.user?.role === "admin", user: ctx.user })),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(512) }))
      .mutation(async ({ input }) => {
        const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const expectedPassword = process.env.ADMIN_PASSWORD;
        if (!expectedEmail || !expectedPassword) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente de produção." });
        }
        const email = input.email.toLowerCase();
        if (!secureEquals(email, expectedEmail) || !secureEquals(input.password, expectedPassword)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        const token = await new SignJWT({ role: "admin", email, name: "Administrador" })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject("local-admin")
          .setIssuedAt()
          .setExpirationTime("12h")
          .sign(localAdminSecret());
        return { token };
      }),
  }),
  beach: router({
    conditions: publicProcedure.query(async () => {
      try {
        return await getBeachConditions();
      } catch {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "As condições da praia estão temporariamente indisponíveis." });
      }
    }),
  }),
  directory: router({
    categories: publicProcedure.query(() => db.getPublicCategories()),
    list: publicProcedure
      .input(z.object({ search: z.string().max(100).optional(), categorySlug: z.string().max(112).optional() }).optional())
      .query(({ input }) => db.getPublicDirectory(input ?? {})),
    featured: publicProcedure.query(() => db.getPublicFeatured()),
    detail: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
      const establishment = await db.getPublicEstablishment(input.slug);
      if (!establishment) throw new TRPCError({ code: "NOT_FOUND", message: "Estabelecimento não encontrado." });
      return establishment;
    }),
  }),
  account: router({
    favoriteIds: protectedProcedure.query(({ ctx }) => db.getFavoriteIds(ctx.user.id)),
    favorites: protectedProcedure.query(({ ctx }) => db.getFavoriteDirectory(ctx.user.id)),
    addFavorite: protectedProcedure.input(z.object({ establishmentId: z.number().int().positive() })).mutation(({ ctx, input }) => db.addFavorite(ctx.user.id, input.establishmentId)),
    removeFavorite: protectedProcedure.input(z.object({ establishmentId: z.number().int().positive() })).mutation(({ ctx, input }) => db.removeFavorite(ctx.user.id, input.establishmentId)),
  }),
  owner: router({
    enroll: protectedProcedure.mutation(async ({ ctx }) => {
      await db.promoteUserToOwner(ctx.user.id);
      return { success: true } as const;
    }),
    overview: ownerProcedure.query(({ ctx }) => db.getOwnerOverview(ctx.user.id)),
    uploadImage: ownerProcedure
      .input(z.object({ fileName: z.string().trim().min(1).max(160), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(1).max(7_000_000) }))
      .mutation(async ({ input, ctx }) => {
        const content = Buffer.from(input.base64, "base64");
        if (!content.length || content.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Envie imagens de até 5 MB." });
        return saveEstablishmentImage({ userId: ctx.user.id, fileName: input.fileName, extension: input.mimeType.split("/")[1], mimeType: input.mimeType, content });
      }),
    createEstablishment: ownerProcedure.input(establishmentSchema).mutation(({ ctx, input }) => {
      const parsed = establishmentSchema.parse(input);
      return db.createOwnedEstablishment({ ...parsed, slug: parsed.slug ? createSlug(parsed.slug) : createSlug(parsed.name) }, ctx.user.id);
    }),
    updateEstablishment: ownerProcedure.input(establishmentSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, slug, name, ...rest } = input;
      return db.updateOwnedEstablishment({ id, ...rest, ...(slug ? { slug: createSlug(slug) } : name ? { slug: createSlug(name) } : {}) }, ctx.user.id);
    }),
    requestPayment: ownerProcedure.input(z.object({ establishmentId: z.number().int().positive(), planId: z.number().int().positive(), purpose: paymentPurposeSchema, ownerNote: z.string().max(4000).optional().nullable() })).mutation(({ ctx, input }) => db.createOwnerPaymentRequest(input, ctx.user.id)),
    submitPixProof: ownerProcedure.input(z.object({ requestId: z.number().int().positive(), pixProofUrl: z.string().url().max(1024), ownerNote: z.string().max(4000).optional().nullable() })).mutation(({ ctx, input }) => db.submitPixProof(input, ctx.user.id)),
  }),
  admin: router({
    overview: adminProcedure.query(() => db.getAdminOverview()),
    paymentSettings: adminProcedure.query(() => db.getPaymentSettings()),
    updatePaymentSettings: adminProcedure.input(z.object({ pixKey: z.string().trim().max(255).optional().nullable(), recipientName: z.string().trim().max(160).optional().nullable(), instructions: z.string().max(4000).optional().nullable() })).mutation(({ ctx, input }) => db.updatePaymentSettings({ ...input, updatedByUserId: ctx.user.id })),
    paymentRequests: adminProcedure.query(() => db.getAdminPaymentRequests()),
    confirmPaymentRequest: adminProcedure.input(z.object({ requestId: z.number().int().positive(), adminNote: z.string().max(4000).optional().nullable(), displayOrder: z.number().int().min(0).optional() })).mutation(({ ctx, input }) => db.confirmPaymentRequest(input, ctx.user.id)),
    rejectPaymentRequest: adminProcedure.input(z.object({ requestId: z.number().int().positive(), adminNote: z.string().max(4000).optional().nullable() })).mutation(({ ctx, input }) => db.rejectPaymentRequest(input, ctx.user.id)),
    uploadImage: adminProcedure
      .input(z.object({ fileName: z.string().trim().min(1).max(160), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(1).max(7_000_000) }))
      .mutation(async ({ input, ctx }) => {
        const content = Buffer.from(input.base64, "base64");
        if (!content.length || content.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Envie imagens de até 5 MB." });
        }
        const extension = input.mimeType.split("/")[1];
        return saveEstablishmentImage({ userId: ctx.user.id, fileName: input.fileName, extension, mimeType: input.mimeType, content });
      }),
    createCategory: adminProcedure
      .input(z.object({ name: z.string().trim().min(2).max(96), icon: z.string().trim().min(2).max(48).default("Store") }))
      .mutation(({ input }) => db.createCategory({ ...input, slug: createSlug(input.name) })),
    updateCategory: adminProcedure
      .input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(96).optional(), icon: z.string().trim().min(2).max(48).optional(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => db.updateCategory({ ...input, slug: input.name ? createSlug(input.name) : undefined })),
    deleteCategory: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteCategory(input.id)),
    createEstablishment: adminProcedure.input(establishmentSchema).mutation(({ input }) => {
      const parsed = establishmentSchema.parse(input);
      return db.createEstablishment({ ...parsed, slug: parsed.slug ? createSlug(parsed.slug) : createSlug(parsed.name) });
    }),
    updateEstablishment: adminProcedure
      .input(establishmentSchema.partial().extend({ id: z.number().int().positive() }))
      .mutation(({ input }) => {
        const { id, slug, name, ...rest } = input;
        return db.updateEstablishment({
          id,
          ...rest,
          ...(slug ? { slug: createSlug(slug) } : name ? { slug: createSlug(name) } : {}),
        });
      }),
    deleteEstablishment: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteEstablishment(input.id)),
    updatePlan: adminProcedure
      .input(z.object({ id: z.number().int().positive(), priceCents: z.number().int().min(0), isActive: z.boolean() }))
      .mutation(({ input }) => db.updateCommercialPlan(input)),
    createSubscription: adminProcedure
      .input(z.object({ establishmentId: z.number().int().positive(), planId: z.number().int().positive(), amountCents: z.number().int().min(0), dueAt: z.coerce.date(), status: statusSchema.default("pendente"), paidAt: z.coerce.date().optional().nullable(), notes: z.string().max(4000).optional().nullable() }))
      .mutation(({ input }) => db.createSubscription(input)),
    updateSubscriptionStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: statusSchema, paidAt: z.coerce.date().optional().nullable() }))
      .mutation(({ input }) => db.updateSubscriptionStatus(input)),
    createFeaturedSlot: adminProcedure
      .input(z.object({ establishmentId: z.number().int().positive(), planId: z.number().int().positive(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), displayOrder: z.number().int().min(0).default(0) }))
      .mutation(({ input }) => db.createFeaturedSlot(input)),
    updateFeaturedSlotStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(({ input }) => db.updateFeaturedSlotStatus(input)),
    seedDemoDirectory: adminProcedure.mutation(() => db.seedDemoDirectory()),
  }),
});

export type AppRouter = typeof appRouter;
