"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export type LessonScaffoldProps = {
	title: string;
	backHref: string;

	board: React.ReactNode;
	explanation: React.ReactNode;
	mascot: React.ReactNode;

	/** スマホ最下部の固定領域（次へボタンなど） */
	footer?: React.ReactNode;

	// 互換 props
	topLabel?: string;
	progress01?: number; // 0..1
	headerRight?: React.ReactNode;
	mobileMascotScale?: number; // default 0.72
};

export function LessonScaffold({
	title,
	backHref,
	board,
	explanation,
	mascot,
	footer,
	topLabel,
	progress01,
	headerRight,
	mobileMascotScale = 0.72,
}: LessonScaffoldProps) {
	return (
		<div className="fixed inset-0 z-[9999] h-[100dvh] w-[100dvw] overflow-hidden bg-[#f6f1e6] text-[#2b2b2b] flex flex-col">
			{/* Header */}
			<header className="h-12 md:h-14 flex items-center justify-between px-3 md:px-6 border-b border-black/10 bg-white/40 backdrop-blur shrink-0">
				<Link
					href={backHref}
					className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors"
				>
					<ChevronLeft className="w-5 h-5" />
					<span className="hidden sm:inline">学習マップ</span>
				</Link>

				<div className="font-bold text-sm md:text-base text-[#3a2b17] flex-1 text-center">
					{title}
				</div>

				<div className="min-w-[80px] flex justify-end">{headerRight ?? <span />}</div>
			</header>

			<main className="flex-1 min-h-0 overflow-hidden">
				{/* ===================== */}
				{/* Desktop (md以上)       */}
				{/* ===================== */}
				<div className="hidden md:grid h-full min-h-0 grid-cols-12 gap-6 p-4 md:p-6">
					{/* Left: board */}
					<section className="col-span-8 h-full min-h-0 flex items-center justify-center">
						<div className="w-full max-w-[760px] aspect-square min-h-0">
							{board}
						</div>
					</section>

					{/* Right: explanation + mascot */}
					<section className="col-span-4 h-full min-h-0 flex flex-col gap-4">
						<div className="flex-none">
							{topLabel ? (
								<div className="text-xs font-bold tracking-wide text-slate-500 mb-2">
									{topLabel}
								</div>
							) : null}

							{typeof progress01 === "number" ? (
								<div className="h-1 bg-black/10 rounded-full overflow-hidden mb-3">
									<div
										className="h-full bg-emerald-500 transition-all"
										style={{ width: `${Math.round(progress01 * 100)}%` }}
									/>
								</div>
							) : null}

							{explanation}
						</div>

						<div className="flex-1 min-h-0 flex items-end justify-end pb-2">
							{mascot}
						</div>

						{footer ? <div className="flex-none">{footer}</div> : null}
					</section>
				</div>

				{/* ===================== */}
				{/* Mobile (<md)          */}
				{/* Duolingo風：上(じい+解説) / 下(盤) / 最下部(ボタン固定) */}
				{/* スクロールなし */}
				{/* ===================== */}
				<div
					className="md:hidden h-full min-h-0 flex flex-col overflow-hidden px-3 pt-3"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
					}}
				>
					{/* 上段：じいちゃん + 解説 */}
					<div className="flex-none">
						<div className="flex items-start gap-3">
							{/* じいちゃん（左上、少し下に突き出す） */}
							<div className="relative w-[112px] shrink-0 overflow-visible">
								<div
									className="pointer-events-none origin-top-left"
									style={{
										transform: `translateY(-22px) scale(${mobileMascotScale})`,
									}}
								>
									{mascot}
								</div>
							</div>

							{/* 解説（右上） */}
							<div className="min-w-0 flex-1">
								{topLabel ? (
									<div className="text-[11px] font-bold tracking-wide text-slate-500">
										{topLabel}
									</div>
								) : null}

								{typeof progress01 === "number" ? (
									<div className="mt-1 h-1 bg-black/10 rounded-full overflow-hidden">
										<div
											className="h-full bg-emerald-500 transition-all"
											style={{ width: `${Math.round(progress01 * 100)}%` }}
										/>
									</div>
								) : null}

								{/* スクロール禁止なので高さを制限して切る */}
								<div className="mt-2 max-h-[28vh] overflow-hidden">
									{explanation}
								</div>
							</div>
						</div>
					</div>

					{/* 下段：盤面（残り全て） */}
					<div className="relative flex-1 min-h-0 flex items-end justify-center pt-2">
						<div className="w-full max-w-[min(92vw,520px)] aspect-square">
							{board}
						</div>
					</div>

					{/* 最下部：次へボタン固定 */}
					{footer ? <div className="flex-none pt-2">{footer}</div> : null}
				</div>
			</main>
		</div>
	);
}


