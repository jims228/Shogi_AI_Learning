/**
 * Spacing/layout constants for Duolingo-style lesson screens.
 * Use these for consistent padding, gaps, and bar heights.
 */
export const LESSON_SPACING = {
  headerPaddingHorizontal: 16,
  headerPaddingVertical: 12,
  progressBarHeight: 17,
  progressBarRadius: 6,
  sectionGap: 14,
  instructionPaddingVertical: 8,
  dialoguePadding: 14,
  dialogueTailSize: 10,
  footerPaddingHorizontal: 18,
  footerPaddingTop: 12,
  footerPaddingBottom: 24,
  footerButtonMinHeight: 56,
} as const;

export const LESSON_COLORS = {
  progressBg: "#e5e7eb",
  progressFill: "#DB6010",
  dialogueBg: "#ffffff",
  dialogueBorder: "#e5e7eb",
} as const;
