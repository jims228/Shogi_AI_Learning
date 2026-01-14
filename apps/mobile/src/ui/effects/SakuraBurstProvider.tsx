import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { SakuraTapBurst, type SakuraTapBurstHandle } from "./SakuraTapBurst";

type SakuraBurstApi = {
  spawn: (pageX: number, pageY: number) => void;
};

const SakuraBurstContext = createContext<SakuraBurstApi | null>(null);

export function SakuraBurstProvider({ children }: { children: React.ReactNode }) {
  // Feature flag: keep the implementation in place, but disable rendering/side-effects for now.
  // Flip to `true` when we want the effect back.
  const enabled = false;

  const ref = useRef<SakuraTapBurstHandle>(null);

  const spawn = useCallback((pageX: number, pageY: number) => {
    ref.current?.spawn(pageX, pageY);
  }, []);

  const value = useMemo(() => ({ spawn }), [spawn]);

  if (!enabled) return <>{children}</>;

  return (
    <SakuraBurstContext.Provider value={value}>
      {children}
      {/* Global overlay: stays mounted across navigation */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <SakuraTapBurst ref={ref} />
      </View>
    </SakuraBurstContext.Provider>
  );
}

export function useSakuraBurst() {
  const ctx = useContext(SakuraBurstContext);
  if (!ctx) {
    // When disabled, we intentionally provide a no-op implementation.
    return { spawn: () => {} };
  }
  return ctx;
}

