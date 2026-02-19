"use client";

import { useEffect, useState } from "react";
import { getMobileParamsFromUrl } from "@/lib/mobileBridge";

/** Returns just the `mobile` flag (legacy compat). */
export function useMobileQueryParam(): boolean {
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

/**
 * Returns { mobile, embed, noai, lid } all from a SINGLE effect.
 * This prevents the race condition where isMobileWebView becomes true
 * before isEmbed, which would briefly show MobileLessonShell instead of
 * the embed-only board.
 */
export function useMobileParams() {
  const [params, setParams] = useState({
    mobile: false,
    embed: false,
    noai: false,
    lid: undefined as string | undefined,
  });

  useEffect(() => {
    try {
      const p = getMobileParamsFromUrl();
      setParams({ mobile: p.mobile, embed: p.embed, noai: p.noai, lid: p.lid });
    } catch {
      /* ignore */
    }
  }, []);

  return params;
}

