export function getWebBaseUrl() {
  return (process.env.EXPO_PUBLIC_WEB_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
}

export function isMvpMode() {
  // MVP mode: show only the pinned set of "guaranteed" lessons (mvp_lessons.json).
  // Defaults:
  // - explicit env wins
  // - otherwise OFF (show all lessons; non-href lessons can be shown as locked/coming soon)
  const raw = (process.env.EXPO_PUBLIC_MVP_MODE || "").trim();
  if (raw === "1" || raw.toLowerCase() === "true") return true;
  if (raw === "0" || raw.toLowerCase() === "false") return false;
  return false;
}


