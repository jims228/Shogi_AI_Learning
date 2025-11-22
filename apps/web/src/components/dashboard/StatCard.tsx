import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  colorClass: string; // e.g. "text-shogi-gold"
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, icon: Icon, colorClass }) => {
  return (
    <div className="bg-shogi-panel rounded-2xl p-4 flex items-center gap-4 border border-white/5 shadow-lg">
      <div className={`p-3 rounded-xl bg-black/20 ${colorClass}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white">{value}</span>
          {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
        </div>
      </div>
    </div>
  );
};
