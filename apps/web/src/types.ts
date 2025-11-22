export type LessonStatus = "locked" | "available" | "completed";
export type LessonCategory = "piece-move" | "tsume-1";

export interface Lesson {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  status: LessonStatus;
  stars?: number; // 0-3
  order: number;
  prerequisites?: string[];
}
