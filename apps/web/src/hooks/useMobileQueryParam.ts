"use client";

import { useEffect, useState } from "react";

export function useMobileQueryParam(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("mobile") === "1";
    } catch {
      return false;
    }
  });

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

