import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { availablePresets, presetOptions } from "@/lib/comcard-layouts";
import { getPerformance } from "@/lib/comcard-insights";
import { rankTemplates } from "@/lib/comcard-ranking";

const Query = z.object({ canvas: z.enum(["portrait", "landscape"]), count: z.coerce.number().int().min(1).max(10) });

/** 템플릿 단계: 실제 사용자들이 끝까지 간 비율로 정렬한 양식 순서 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  const q = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!q.success) return NextResponse.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 });
  const { canvas, count } = q.data;
  const fit = availablePresets(canvas, count);
  const allowed = (fit.length ? fit : presetOptions(canvas, count).map(o => o.preset)).map(p => p.id as string);
  const insight = rankTemplates(await getPerformance(), canvas, count, allowed);
  return NextResponse.json(insight, { headers: { "Cache-Control": "private, max-age=600" } });
}
