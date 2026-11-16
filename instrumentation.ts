import type { Instrumentation } from "next";

/** 서버에서 난 오류(화면 그리기·API·서버 액션)를 자동 수집 → 매일 점검·주간 보고에 반영 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordErrors } = await import("./lib/errors-server");
    const e = err as Error & { digest?: string };
    await recordErrors([{
      source: "server",
      message: e.message || e.digest || "server error",
      stack: e.stack ?? null,
      path: request.path,
      route: `${context.routeType}:${context.routePath}`,
      platform: "server",
    }]);
  } catch { /* 기록 실패가 원래 요청에 영향 주지 않게 */ }
};
