export const theme = {
  colors: {
    bg: "#ffffff",
    surface: "#ffffff",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#e5e7eb",
    brand: "#58cc02",
    brandDark: "#3da700",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
    ink: "#0f172a",
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
  typography: {
    h1: { fontSize: 22, fontWeight: "900" as const, letterSpacing: 0.2 },
    h2: { fontSize: 16, fontWeight: "900" as const, letterSpacing: 0.2 },
    body: { fontSize: 14, fontWeight: "700" as const },
    sub: { fontSize: 12, fontWeight: "800" as const },
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
    },
    button: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
  },
};

export type Theme = typeof theme;

