"use client";

import { useEffect, useState } from "react";

/**
 * Avoid hydration mismatch:
 * - We DO NOT read `window.location` during render.
 * - We resolve `mobile=1` after mount and return the boolean.
 */
export function useMobileQueryParam() {
  const [mobile, setMobile] = useState(false);

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

