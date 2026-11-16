import { NextResponse } from "next/server";
import { z } from "zod";
import { recordErrors } from "@/lib/errors-server";

const Item = z.object({
  message: z.string().min(1).max(1000),
  stack: z.string().max(4000).nullish(),
  path: z.string().max(300).nullish(),
});
const Body = z.object({
  anon_id: z.string().max(64).optional(),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  errors: z.array(Item).min(1).max(10),
});

/** 화면에서 난 오류 받기 (로그인 불필요, 실패해도 조용히) */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const { anon_id, platform, errors } = parsed.data;
  await recordErrors(errors.map(e => ({ source: "client", message: e.message, stack: e.stack, path: e.path, platform, anon_id })));
  return new NextResponse(null, { status: 204 });
}
