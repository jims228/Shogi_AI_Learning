"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

interface KifuPlayerProps {
  moves: string[];
  renderBoard: (ply: number) => React.ReactNode;
  speedMs?: number;
  initialPly?: number;
  onPlyChange?: (ply: number) => void;
}

export const KifuPlayer: React.FC<KifuPlayerProps> = ({
  moves,
  renderBoard,
  speedMs = 750,
  initialPly = 0,
  onPlyChange
}) => {
  const [currentPly, setCurrentPly] = useState(initialPly);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxPly = moves.length;

  // 手数変更時のコールバック
  const handlePlyChange = useCallback((newPly: number) => {
    const clampedPly = Math.max(0, Math.min(newPly, maxPly));
    setCurrentPly(clampedPly);
    onPlyChange?.(clampedPly);
  }, [maxPly, onPlyChange]);

  // 再生制御
  const handlePlay = useCallback(() => {
    if (currentPly >= maxPly) {
      // 最後まで再生済みの場合は最初から
      handlePlyChange(0);
    }
    setIsPlaying(true);
  }, [currentPly, maxPly, handlePlyChange]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  const handleNext = useCallback(() => {
    if (currentPly < maxPly) {
      handlePlyChange(currentPly + 1);
    }
  }, [currentPly, maxPly, handlePlyChange]);

  const handlePrev = useCallback(() => {
    if (currentPly > 0) {
      handlePlyChange(currentPly - 1);
    }
  }, [currentPly, handlePlyChange]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    handlePlyChange(0);
  }, [handlePlyChange]);

  // 自動再生処理
  useEffect(() => {
    if (isPlaying && currentPly < maxPly) {
      intervalRef.current = setTimeout(() => {
        const nextPly = currentPly + 1;
        handlePlyChange(nextPly);
        
        // 最後まで再生したら停止
        if (nextPly >= maxPly) {
          setIsPlaying(false);
        }
      }, speedMs);
    } else {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, currentPly, maxPly, speedMs, handlePlyChange]);

  // キーボードイベント処理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // フォーカスされた入力要素がある場合はスキップ
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key) {
        case ' ':
          event.preventDefault();
          handleTogglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handleNext();
          break;
        case 'Home':
          event.preventDefault();
          handleReset();
          break;
        case 'End':
          event.preventDefault();
          handlePlyChange(maxPly);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handlePrev, handleNext, handleReset, handlePlyChange, maxPly]);

  // 右クリックで次の手
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    handleNext();
  }, [handleNext]);

  return (
    <Card className="p-4 space-y-4">
      <div 
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className="select-none"
        role="application"
        aria-label="棋譜再生プレイヤー"
      >
        {/* 盤面表示 */}
        <div className="flex justify-center">
          {renderBoard(currentPly)}
        </div>

        {/* 進捗表示 */}
        <div className="text-center text-sm text-muted-foreground">
          {currentPly} / {maxPly} 手目
          {currentPly > 0 && moves[currentPly - 1] && (
            <span className="ml-2 font-mono">
              ({currentPly}. {moves[currentPly - 1]})
            </span>
          )}
        </div>

        {/* スライダー */}
        <div className="px-2">
          <Slider
            value={[currentPly]}
            min={0}
            max={maxPly}
            step={1}
            onValueChange={([value]) => handlePlyChange(value)}
            className="w-full"
            aria-label={`棋譜の位置: ${currentPly} / ${maxPly}`}
          />
        </div>

        {/* コントロールボタン */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={currentPly === 0}
            title="最初に戻る (Home)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={currentPly === 0}
            title="前の手 (←)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleTogglePlay}
            disabled={maxPly === 0}
            className="min-w-20"
            title={isPlaying ? "一時停止 (Space)" : "再生 (Space)"}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-1" />
                停止
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                再生
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentPly >= maxPly}
            title="次の手 (→ または 右クリック)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* 操作説明 */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <div>
            <span className="font-medium">Space:</span> 再生/停止 | 
            <span className="font-medium"> ←→:</span> 前/次の手 | 
            <span className="font-medium"> 右クリック:</span> 次の手
          </div>
          <div>
            <span className="font-medium">Home:</span> 最初 | 
            <span className="font-medium">End:</span> 最後
          </div>
        </div>
      </div>
    </Card>
  );
};