export function getMobileParamsFromUrl() {
  try {
    if (typeof window === "undefined") return { mobile: false, noai: false, lid: undefined as string | undefined };
    const sp = new URLSearchParams(window.location.search);
    return {
      mobile: sp.get("mobile") === "1",
      noai: sp.get("noai") === "1",
      lid: sp.get("lid") ?? undefined,
    };
  } catch {
    return { mobile: false, noai: false, lid: undefined as string | undefined };
  }
}

export function postMobileLessonCompleteOnce(lessonId?: string) {
  try {
    if (typeof window === "undefined") return;
    const { mobile, lid } = getMobileParamsFromUrl();
    if (!mobile) return;

    const finalLessonId = lessonId ?? lid;
    const w = window as any;
    if (!w.ReactNativeWebView || typeof w.ReactNativeWebView.postMessage !== "function") return;

    // single-shot guard (per page load)
    if (!w.__RN_LESSON_COMPLETE_SENT__) w.__RN_LESSON_COMPLETE_SENT__ = {};
    const key = finalLessonId ?? "__unknown__";
    if (w.__RN_LESSON_COMPLETE_SENT__[key]) return;
    w.__RN_LESSON_COMPLETE_SENT__[key] = true;

    w.ReactNativeWebView.postMessage(JSON.stringify({ type: "lessonComplete", lessonId: finalLessonId }));
  } catch {
    // ignore
  }
}


