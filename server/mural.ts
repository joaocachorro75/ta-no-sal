import { and, desc, eq, inArray } from "drizzle-orm";
import { muralComments, muralLikes, muralPostImages, muralPosts, users } from "../drizzle/schema";
import { requireDb } from "./db";

type PostInput = { caption: string; allowsComments: boolean; latitude?: number | null; longitude?: number | null; locationLabel?: string | null; images: string[] };

async function imagesByPostIds(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return new Map<number, { id: number; imageUrl: string; sortOrder: number }[]>();
  const images = await db.select().from(muralPostImages).where(inArray(muralPostImages.muralPostId, ids)).orderBy(muralPostImages.sortOrder);
  return images.reduce((map, image) => { const current = map.get(image.muralPostId) ?? []; current.push(image); map.set(image.muralPostId, current); return map; }, new Map<number, typeof images>());
}

async function decoratePosts<T extends { id: number }>(posts: T[], viewerId?: number) {
  const db = await requireDb();
  const ids = posts.map(post => post.id);
  const images = await imagesByPostIds(ids);
  const likes = ids.length ? await db.select().from(muralLikes).where(inArray(muralLikes.muralPostId, ids)) : [];
  return posts.map(post => ({ ...post, images: images.get(post.id) ?? [], likeCount: likes.filter(like => like.muralPostId === post.id).length, likedByViewer: viewerId ? likes.some(like => like.muralPostId === post.id && like.userId === viewerId) : false }));
}

export async function getMuralFeed(viewerId?: number) {
  const db = await requireDb();
  const posts = await db.select({ post: muralPosts, authorName: users.name }).from(muralPosts).leftJoin(users, eq(muralPosts.userId, users.id)).where(eq(muralPosts.status, "aprovado")).orderBy(desc(muralPosts.createdAt));
  return decoratePosts(posts.map(row => ({ ...row.post, authorName: row.authorName })), viewerId);
}

export async function getMuralPost(id: number, viewerId?: number) {
  const db = await requireDb();
  const rows = await db.select({ post: muralPosts, authorName: users.name }).from(muralPosts).leftJoin(users, eq(muralPosts.userId, users.id)).where(and(eq(muralPosts.id, id), eq(muralPosts.status, "aprovado"))).limit(1);
  if (!rows[0]) return undefined;
  const post = (await decoratePosts([{ ...rows[0].post, authorName: rows[0].authorName }], viewerId))[0];
  const comments = await db.select({ comment: muralComments, authorName: users.name }).from(muralComments).leftJoin(users, eq(muralComments.userId, users.id)).where(and(eq(muralComments.muralPostId, id), eq(muralComments.status, "aprovado"))).orderBy(muralComments.createdAt);
  return { ...post, comments: comments.map(row => ({ ...row.comment, authorName: row.authorName })) };
}

export async function createMuralPost(userId: number, input: PostInput) {
  const db = await requireDb();
  const created = await db.insert(muralPosts).values({ userId, caption: input.caption, allowsComments: input.allowsComments, latitude: input.latitude ?? null, longitude: input.longitude ?? null, locationLabel: input.locationLabel ?? null });
  const muralPostId = Number(created[0].insertId);
  await db.insert(muralPostImages).values(input.images.map((imageUrl, sortOrder) => ({ muralPostId, imageUrl, sortOrder })));
  return { muralPostId, status: "pendente" as const };
}

export async function toggleMuralLike(userId: number, muralPostId: number) {
  const db = await requireDb();
  const posts = await db.select().from(muralPosts).where(and(eq(muralPosts.id, muralPostId), eq(muralPosts.status, "aprovado"))).limit(1);
  if (!posts[0]) throw new Error("Publicação indisponível.");
  const existing = await db.select().from(muralLikes).where(and(eq(muralLikes.muralPostId, muralPostId), eq(muralLikes.userId, userId))).limit(1);
  if (existing[0]) { await db.delete(muralLikes).where(eq(muralLikes.id, existing[0].id)); return { liked: false }; }
  await db.insert(muralLikes).values({ muralPostId, userId });
  return { liked: true };
}

export async function createMuralComment(userId: number, input: { muralPostId: number; body: string }) {
  const db = await requireDb();
  const posts = await db.select().from(muralPosts).where(and(eq(muralPosts.id, input.muralPostId), eq(muralPosts.status, "aprovado"))).limit(1);
  if (!posts[0]) throw new Error("Publicação indisponível.");
  if (!posts[0].allowsComments) throw new Error("O autor optou por não receber comentários nesta publicação.");
  await db.insert(muralComments).values({ muralPostId: input.muralPostId, userId, body: input.body });
  return { status: "pendente" as const };
}

export async function getAdminMuralModeration() {
  const db = await requireDb();
  const posts = await db.select({ post: muralPosts, authorName: users.name, authorEmail: users.email }).from(muralPosts).leftJoin(users, eq(muralPosts.userId, users.id)).where(eq(muralPosts.status, "pendente")).orderBy(desc(muralPosts.createdAt));
  const comments = await db.select({ comment: muralComments, postCaption: muralPosts.caption, authorName: users.name }).from(muralComments).leftJoin(muralPosts, eq(muralComments.muralPostId, muralPosts.id)).leftJoin(users, eq(muralComments.userId, users.id)).where(eq(muralComments.status, "pendente")).orderBy(desc(muralComments.createdAt));
  return { posts: await decoratePosts(posts.map(row => ({ ...row.post, authorName: row.authorName, authorEmail: row.authorEmail }))), comments: comments.map(row => ({ ...row.comment, postCaption: row.postCaption, authorName: row.authorName })) };
}

export async function reviewMuralPost(id: number, adminId: number, approved: boolean, adminNote?: string | null) {
  const db = await requireDb();
  await db.update(muralPosts).set({ status: approved ? "aprovado" : "recusado", adminNote: adminNote ?? null, reviewedByUserId: adminId, reviewedAt: new Date() }).where(and(eq(muralPosts.id, id), eq(muralPosts.status, "pendente")));
  return { success: true };
}

export async function reviewMuralComment(id: number, adminId: number, approved: boolean) {
  const db = await requireDb();
  await db.update(muralComments).set({ status: approved ? "aprovado" : "recusado", reviewedByUserId: adminId, reviewedAt: new Date() }).where(and(eq(muralComments.id, id), eq(muralComments.status, "pendente")));
  return { success: true };
}
