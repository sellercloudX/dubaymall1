import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showValue?: boolean;
  totalReviews?: number;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showValue = false,
  totalReviews,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const handleClick = (index: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: maxRating }).map((_, index) => {
          const filled = index < Math.floor(rating);
          const partial = !filled && index < rating;
          
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(index)}
              disabled={!interactive}
              className={cn(
                'relative',
                interactive && 'cursor-pointer hover:scale-110 transition-transform',
                !interactive && 'cursor-default'
              )}
            >
              {/* Background star */}
              <Star
                className={cn(
                  sizeClasses[size],
                  'text-muted-foreground/30'
                )}
              />
              {/* Filled star */}
              {(filled || partial) && (
                <Star
                  className={cn(
                    sizeClasses[size],
                    'absolute inset-0 text-yellow-500 fill-yellow-500',
                    partial && 'clip-path-half'
                  )}
                  style={partial ? { clipPath: `inset(0 ${100 - (rating % 1) * 100}% 0 0)` } : undefined}
                />
              )}
            </button>
          );
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium ml-1">
          {rating > 0 ? rating.toFixed(1) : '0'}
        </span>
      )}
      {totalReviews !== undefined && (
        <span className="text-sm text-muted-foreground ml-1">
          ({totalReviews})
        </span>
      )}
    </div>
  );
}
