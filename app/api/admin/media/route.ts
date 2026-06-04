import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import type { MediaType, DeviceTarget } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return !!(session?.user && isAdminRole(session.user.role));
}

const VALID_TYPES: MediaType[]    = ["IMAGE", "VIDEO"];
const VALID_TARGETS: DeviceTarget[] = ["DESKTOP", "MOBILE", "BOTH"];

function validate(body: Record<string, unknown>): string | null {
  const { page, mediaType, deviceTarget, imageUrl, videoUrl, posterUrl, sortOrder, active } = body;

  if (!page || typeof page !== "string" || !page.trim())
    return "page is required";
  if (!VALID_TYPES.includes(mediaType as MediaType))
    return "mediaType must be IMAGE or VIDEO";
  if (!VALID_TARGETS.includes(deviceTarget as DeviceTarget))
    return "deviceTarget must be DESKTOP, MOBILE, or BOTH";
  if (mediaType === "IMAGE" && (typeof imageUrl !== "string" || !imageUrl.trim()))
    return "imageUrl is required for IMAGE type";
  if (mediaType === "VIDEO" && (typeof videoUrl !== "string" || !videoUrl.trim()))
    return "videoUrl is required for VIDEO type";
  if (mediaType === "VIDEO" && (typeof posterUrl !== "string" || !posterUrl.trim()))
    return "posterUrl is required for VIDEO type — needed as mobile fallback";
  if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0)
    return "sortOrder must be a non-negative integer";
  if (typeof active !== "boolean")
    return "active must be a boolean";

  return null;
}

function coerce(body: Record<string, unknown>) {
  return {
    page:         (body.page as string).trim(),
    mediaType:    body.mediaType as MediaType,
    deviceTarget: body.deviceTarget as DeviceTarget,
    imageUrl:     typeof body.imageUrl  === "string" ? body.imageUrl.trim()  : "",
    videoUrl:     typeof body.videoUrl  === "string" ? body.videoUrl.trim()  : "",
    posterUrl:    typeof body.posterUrl === "string" ? body.posterUrl.trim() : "",
    altText:      typeof body.altText   === "string" ? body.altText.trim()   : "",
    title:        typeof body.title     === "string" ? body.title.trim()     : "",
    sortOrder:    body.sortOrder as number,
    active:       body.active as boolean,
  };
}

export async function GET(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = new URL(req.url).searchParams.get("page");
  const items = await prisma.pageMedia.findMany({
    where: page ? { page } : undefined,
    orderBy: [{ page: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const item = await prisma.pageMedia.create({ data: coerce(body) });
  revalidateTag("page-media");
  return NextResponse.json(item, { status: 201 });
}

export async function PUT(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id)
    return NextResponse.json({ error: "id is required in body" }, { status: 400 });

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const item = await prisma.pageMedia.update({
    where: { id: body.id as string },
    data:  coerce(body),
  });
  revalidateTag("page-media");
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  await prisma.pageMedia.delete({ where: { id } });
  revalidateTag("page-media");
  return NextResponse.json({ success: true });
}
