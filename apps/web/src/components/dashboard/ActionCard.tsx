import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowRight } from "lucide-react";

interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: "blue" | "pink" | "gold";
  progress?: number;
}

export const ActionCard: React.FC<ActionCardProps> = ({ title, description, href, icon: Icon, color, progress }) => {
  const colorStyles = {
    blue: "bg-blue-500 shadow-blue-900/20",
    pink: "bg-shogi-pink shadow-pink-900/20",
    gold: "bg-shogi-gold shadow-amber-900/20",
  };

  const iconBgStyles = {
    blue: "bg-blue-600",
    pink: "bg-rose-500",
    gold: "bg-amber-500",
  };

  return (
    <Link href={href} className="group block relative">
      <div className={`
        relative overflow-hidden rounded-3xl p-6 h-full transition-all duration-300
        hover:translate-y-[-4px] hover:shadow-xl border border-white/10
        bg-shogi-panel
      `}>
        {/* Background Gradient Accent */}
        <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl -mr-10 -mt-10 ${colorStyles[color]}`} />

        <div className="flex justify-between items-start mb-4">
          <div className={`p-3 rounded-2xl text-white shadow-lg ${iconBgStyles[color]}`}>
            <Icon size={28} strokeWidth={2.5} />
          </div>
          <div className="bg-black/20 rounded-full p-2 text-slate-400 group-hover:text-white transition-colors">
            <ArrowRight size={20} />
          </div>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{description}</p>

        {progress !== undefined && (
          <div className="w-full bg-black/30 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full rounded-full ${iconBgStyles[color]}`} 
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </Link>
  );
};
