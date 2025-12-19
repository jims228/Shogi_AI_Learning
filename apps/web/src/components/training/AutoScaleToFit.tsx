"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AutoScaleToFitProps = {
  minScale?: number;      // 下限
  maxScale?: number;      // 上限（1より大きくできる）
  fitMode?: "both" | "width-only";  // width だけでフィットするモード
  className?: string;
  children: React.ReactNode;
};

type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function AutoScaleToFit({
  minScale = 0.6,
  maxScale = 1.35,
  fitMode = "both",  // デフォルトは両方
  className,
  children,
}: AutoScaleToFitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastValidScaleRef = useRef<number>(1);  // 前回のスケール値を保持

  const [containerSize, setContainerSize] = useState<Size>({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState<Size>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    const contentEl = contentRef.current;
    if (!containerEl || !contentEl) return;

    const readSizes = () => {
      setContainerSize({
        width: containerEl.clientWidth,
        height: containerEl.clientHeight,
      });

      // transformの影響を受けない"素の"サイズ
      setContentSize({
        width: contentEl.offsetWidth,
        height: contentEl.offsetHeight,
      });
    };

    readSizes();

    const observer = new ResizeObserver(() => readSizes());
    observer.observe(containerEl);
    observer.observe(contentEl);

    window.addEventListener("resize", readSizes);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", readSizes);
    };
  }, []);

  const { scale, scaledSize } = useMemo(() => {
    const availableW = containerSize.width;
    const availableH = containerSize.height;
    const contentW = contentSize.width;
    const contentH = contentSize.height;

    // 親サイズ或いは子サイズが 0 の場合の処理
    const parentSizeZero = availableW <= 0 || availableH <= 0;
    const contentSizeZero = contentW <= 0 || contentH <= 0;

    if (contentSizeZero) {
      console.log("[DEBUG-AutoScaleToFit] Content size is 0 - returning lastValidScale:", {
        contentW,
        contentH,
        lastValidScale: lastValidScaleRef.current,
      });
      return { 
        scale: lastValidScaleRef.current, 
        scaledSize: { 
          width: contentW * lastValidScaleRef.current, 
          height: contentH * lastValidScaleRef.current 
        } 
      };
    }

    // 親が 0 の場合、fitMode に応じた処理
    if (parentSizeZero) {
      if (fitMode === "width-only" && availableW > 0) {
        // width だけでフィット（height は無視）
        const scaleW = availableW / contentW;
        const nextScale = clamp(scaleW, minScale, maxScale);
        lastValidScaleRef.current = nextScale;

        console.log("[DEBUG-AutoScaleToFit] Width-only mode (height=0):", {
          availableW,
          contentW,
          scaleW,
          nextScale,
        });

        return {
          scale: nextScale,
          scaledSize: { width: contentW * nextScale, height: contentH * nextScale },
        };
      } else if (fitMode === "both" || availableW <= 0) {
        // parent が完全に 0 → 前回のスケール値を使う
        console.log("[DEBUG-AutoScaleToFit] Parent size is 0 - using lastValidScale:", {
          availableW,
          availableH,
          contentW,
          contentH,
          lastValidScale: lastValidScaleRef.current,
        });
        return { 
          scale: lastValidScaleRef.current, 
          scaledSize: { 
            width: contentW * lastValidScaleRef.current, 
            height: contentH * lastValidScaleRef.current 
          } 
        };
      }
    }

    // 通常処理：親と子の両方が > 0
    const scaleW = availableW / contentW;
    const scaleH = availableH / contentH;

    const raw = fitMode === "width-only" ? scaleW : Math.min(scaleW, scaleH);
    const nextScale = clamp(raw, minScale, maxScale);
    lastValidScaleRef.current = nextScale;

    console.log("[DEBUG-AutoScaleToFit] Scale calculated:", {
      containerSize: { width: availableW, height: availableH },
      contentSize: { width: contentW, height: contentH },
      scaleW,
      scaleH,
      raw,
      nextScale,
      minScale,
      maxScale,
      scaledSize: { width: contentW * nextScale, height: contentH * nextScale },
    });

    return {
      scale: nextScale,
      scaledSize: { width: contentW * nextScale, height: contentH * nextScale },
    };
  }, [containerSize, contentSize, minScale, maxScale, fitMode]);

  return (
    <div ref={containerRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      <div className="flex h-full w-full items-center justify-start">
        <div
          className="relative"
          style={{
            width: scaledSize.width > 0 ? `${scaledSize.width}px` : undefined,
            height: scaledSize.height > 0 ? `${scaledSize.height}px` : undefined,
          }}
        >
          <div
            className="absolute left-0 top-0"
            style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <div ref={contentRef} className="inline-block">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
