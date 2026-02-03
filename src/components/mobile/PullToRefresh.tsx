import { useState, useRef, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - startY.current);
    
    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(distance * 0.5, THRESHOLD * 1.5));
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    
    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex justify-center items-center transition-transform"
        style={{ 
          height: THRESHOLD,
          top: -THRESHOLD,
          transform: `translateY(${pullDistance}px)`,
          opacity: progress
        }}
      >
        <div className={cn(
          "flex items-center gap-2 text-muted-foreground",
          isRefreshing && "text-primary"
        )}>
          <Loader2 
            className={cn(
              "h-5 w-5 transition-transform",
              isRefreshing && "animate-spin"
            )}
            style={{ transform: `rotate(${progress * 360}deg)` }}
          />
          <span className="text-sm">
            {isRefreshing ? "Yangilanmoqda..." : progress >= 1 ? "Qo'yib yuboring" : "Yangilash uchun torting"}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div style={{ transform: `translateY(${pullDistance}px)`, transition: isPulling ? 'none' : 'transform 0.2s' }}>
        {children}
      </div>
    </div>
  );
}
