"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { SakuraPetals } from "@/components/ui/SakuraPetals";

function isSakuraRoute(pathname: string | null) {
  if (!pathname) return false;
  return pathname === "/learn/roadmap" || pathname.startsWith("/training");
}

export function SakuraThemeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const enabled = isSakuraRoute(pathname);

  const outerClass = useMemo(() => {
    const base = "relative h-full min-h-screen";
    return enabled ? `${base} sakura-theme sakura-surface` : base;
  }, [enabled]);

  const contentClass = useMemo(() => {
    const base =
      "relative z-[20] h-full flex flex-col px-4 sm:px-6 lg:px-12 xl:px-[220px] 2xl:px-[260px] py-6 gap-6";
    return base;
  }, []);

  return (
    <div className={outerClass}>
      {enabled ? <div className="sakura-backdrop-layer" aria-hidden="true" /> : null}
      {enabled ? <SakuraPetals /> : null}
      <div className={contentClass}>
        <main className="flex-1 w-full min-h-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}


