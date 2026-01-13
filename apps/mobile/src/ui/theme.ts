export const theme = {
  colors: {
    // Sakura / "almost white" background
    bg: "#ffffff",
    surface: "#ffffff",
    // very subtle tint for sections / icon bubbles
    surfaceTint: "#fff0f6",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#efe1e8",
    // Primary (sakura pink)
    brand: "#E65A8D",
    brandDark: "#C84474",
    success: "#22c55e",
    danger: "#ef4444",
    warning: "#f59e0b",
    ink: "#0f172a",
    sakuraPetal: "#f7a7c0",
    sakuraPetalDeep: "#e96e9a",
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
    lg: 20,
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
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    button: {
      shadowColor: "#000",
      shadowOpacity: 0.10,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
  },
};

export type Theme = typeof theme;

