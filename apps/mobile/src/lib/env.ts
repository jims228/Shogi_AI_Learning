export function getWebBaseUrl() {
  return (process.env.EXPO_PUBLIC_WEB_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return (process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
}


