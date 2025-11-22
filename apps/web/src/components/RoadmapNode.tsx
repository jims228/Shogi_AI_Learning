import React from "react";
import { Lesson } from "../types";
import { Star, Lock, Play, CheckCircle } from "lucide-react";

interface RoadmapNodeProps {
  lesson: Lesson;
  isSelected: boolean;
  onClick: () => void;
}

export const RoadmapNode: React.FC<RoadmapNodeProps> = ({ lesson, isSelected, onClick }) => {
  const isLocked = lesson.status === "locked";
  const isCompleted = lesson.status === "completed";

  return (
    <div 
      className={`relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105 ${isLocked ? "opacity-50 cursor-not-allowed" : ""}`}
      onClick={onClick}
    >
      <div 
        className={`
          w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-lg z-10
          ${isSelected ? "ring-4 ring-blue-400 ring-offset-2 ring-offset-slate-900" : ""}
          ${isCompleted ? "bg-yellow-500 border-yellow-600" : 
            isLocked ? "bg-slate-700 border-slate-600" : "bg-blue-500 border-blue-600"}
        `}
      >
        {isLocked ? (
          <Lock className="text-slate-400 w-8 h-8" />
        ) : isCompleted ? (
          <CheckCircle className="text-white w-8 h-8" />
        ) : (
          <Play className="text-white w-8 h-8 fill-current" />
        )}
      </div>
      
      {/* Stars for completed lessons */}
      {isCompleted && lesson.stars && (
        <div className="flex gap-1 mt-1 absolute -top-4">
          {[...Array(lesson.stars)].map((_, i) => (
            <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
          ))}
        </div>
      )}

      <div className="mt-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 shadow-md">
        <span className="text-sm font-bold text-slate-200">{lesson.title}</span>
      </div>
    </div>
  );
};
