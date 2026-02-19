"use client";

import { useEffect, useState } from "react";

export function useMobileQueryParam(): boolean {
  // Always initialize false so SSR and first client render match (avoids hydration mismatch).
  // The actual value is read after mount via useEffect.
  const [mobile, setMobile] = useState<boolean>(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      setMobile(sp.get("mobile") === "1");
    } catch {
      setMobile(false);
    }
  }, []);

  return mobile;
}

