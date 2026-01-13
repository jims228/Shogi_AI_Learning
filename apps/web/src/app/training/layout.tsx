import type { Viewport } from "next";

// Training (mobile=1 in WebView) sometimes looks "slightly zoomed" on Android.
// Locking viewport here keeps page scale stable without touching board scaling logic.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

