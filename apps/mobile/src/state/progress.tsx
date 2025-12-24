import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type MobileProgress = {
  completedLessonIds: string[];
  lastPlayedLessonId?: string;
};

const STORAGE_KEY = "mobileProgress:v1";

type ProgressContextValue = {
  progress: MobileProgress;
  isLoaded: boolean;
  markCompleted: (lessonId: string) => void;
  setLastPlayed: (lessonId: string) => void;
  reset: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<MobileProgress>({ completedLessonIds: [] });
  const [isLoaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const ids = Array.isArray(parsed.completedLessonIds) ? parsed.completedLessonIds.filter(Boolean) : [];
            setProgress({
              completedLessonIds: ids,
              lastPlayedLessonId: typeof parsed.lastPlayedLessonId === "string" ? parsed.lastPlayedLessonId : undefined,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoaded(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: MobileProgress) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const markCompleted = useCallback(
    (lessonId: string) => {
      setProgress((prev) => {
        if (prev.completedLessonIds.includes(lessonId)) return prev;
        const next = { ...prev, completedLessonIds: [...prev.completedLessonIds, lessonId] };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const setLastPlayed = useCallback(
    (lessonId: string) => {
      setProgress((prev) => {
        const next = { ...prev, lastPlayedLessonId: lessonId };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    const next: MobileProgress = { completedLessonIds: [] };
    setProgress(next);
    void persist(next);
  }, [persist]);

  const value = useMemo<ProgressContextValue>(
    () => ({ progress, isLoaded, markCompleted, setLastPlayed, reset }),
    [isLoaded, markCompleted, progress, reset, setLastPlayed],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}


