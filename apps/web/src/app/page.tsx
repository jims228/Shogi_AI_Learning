// apps/web/src/app/page.tsx
import Link from "next/link";
import { Swords, Map, BookOpenCheck, Bell, UserCircle } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
           {/* Logo */}
           <div className="font-bold text-xl tracking-tight select-none">
             <span className="text-white">Shogi AI</span>
             <span className="text-sky-400 ml-1">Learning</span>
           </div>
           {/* Icons */}
           <div className="flex items-center gap-4">
             <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
               <Bell className="w-6 h-6 text-slate-300" />
             </button>
             <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
               <UserCircle className="w-8 h-8 text-slate-300" />
             </button>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 px-4 max-w-3xl mx-auto space-y-6">
        
        {/* Mascot Message Card */}
        <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 flex items-center justify-between relative overflow-hidden backdrop-blur-sm">
          <div className="z-10">
            <div className="text-sky-400 font-bold text-sm mb-1">ドラゴ</div>
            <p className="text-lg font-medium text-slate-100 leading-relaxed">
              おかえり！今日は「棒銀」の復習から始めるといい感じだぞ！
            </p>
          </div>
          {/* Avatar Placeholder */}
          <div className="w-16 h-16 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center text-3xl shadow-lg border-4 border-slate-800 ml-4">
            🐲
          </div>
        </div>

        {/* Feature Cards */}
        <div className="space-y-4">
          {/* Card 1: Play */}
          <Link href="/play" className="block group">
            <div className="bg-blue-600 rounded-[32px] p-6 md:p-8 flex items-center gap-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-900/20 cursor-pointer">
               <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                 <Swords className="w-8 h-8 text-white" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-white mb-1">実践対局</h2>
                 <p className="text-blue-100 font-medium">AIまたは人と対局</p>
               </div>
            </div>
          </Link>

          {/* Card 2: Learn */}
          <Link href="/learn" className="block group">
            <div className="bg-teal-600 rounded-[32px] p-6 md:p-8 flex items-center gap-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-teal-900/20 cursor-pointer">
               <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                 <Map className="w-8 h-8 text-white" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-white mb-1">特訓</h2>
                 <p className="text-teal-100 font-medium">ロードマップを進める</p>
               </div>
            </div>
          </Link>

          {/* Card 3: Annotate */}
          <Link href="/annotate" className="block group">
            <div className="bg-rose-600 rounded-[32px] p-6 md:p-8 flex items-center gap-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-rose-900/20 cursor-pointer">
               <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
                 <BookOpenCheck className="w-8 h-8 text-white" />
               </div>
               <div>
                 <h2 className="text-2xl font-bold text-white mb-1">棋譜解析</h2>
                 <p className="text-rose-100 font-medium">自分の対局をアップロードしてAI解析</p>
               </div>
            </div>
          </Link>
        </div>

      </main>
    </div>
  );
}
