import roadmapJson from "./roadmap.json";

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


