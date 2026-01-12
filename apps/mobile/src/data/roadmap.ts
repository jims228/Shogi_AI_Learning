import roadmapJson from "./roadmap.json";
import mvpLessonIdsJson from "./mvp_lessons.json";
import { isMvpMode } from "../lib/env";

export type RoadmapLesson = {
  /** Original order in apps/web/src/constants.ts (LESSONS array). */
  index: number;
  id: string;
  title: string;
  description: string;
  category: string;
  status: "available" | "locked" | string;
  order: number;
  href: string | null;
  prerequisites: string[];
  stars: number;
};

export type RoadmapData = {
  version: number;
  lessons: RoadmapLesson[];
};

export const ROADMAP: RoadmapData = roadmapJson as RoadmapData;

export const MVP_LESSON_IDS: string[] = (mvpLessonIdsJson as unknown as string[]).filter(Boolean);

export function getRoadmapLessons(): RoadmapLesson[] {
  const all = ROADMAP.lessons;
  if (!isMvpMode()) return all;
  const set = new Set(MVP_LESSON_IDS);
  return all.filter((l) => set.has(l.id));
}

export type FlatRoadmapItem = {
  lessonId: string;
  title: string;
  subtitle?: string;
  href?: string;
  locked: boolean;
  index: number;
};

export function getFlatRoadmapItems(): FlatRoadmapItem[] {
  return getRoadmapLessons()
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((l) => ({
      lessonId: l.id,
      title: l.title,
      subtitle: l.description || undefined,
      href: l.href || undefined,
      locked: !l.href,
      index: l.index,
    }));
}


