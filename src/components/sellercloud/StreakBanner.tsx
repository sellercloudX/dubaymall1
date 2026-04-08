import { useActivityStreak } from '@/hooks/useActivityStreak';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Gift, Target } from 'lucide-react';

export function StreakBanner() {
  const { streak, nextStreakMilestone, isLoading } = useActivityStreak();

  if (isLoading || !streak || streak.current_streak < 2) return null;

  const daysToNext = nextStreakMilestone
    ? nextStreakMilestone.min_amount - streak.current_streak
    : null;

  return (
    <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/5 to-red-500/5">
      <CardContent className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {streak.current_streak}
            </span>
            <span className="text-xs text-muted-foreground">kun streak</span>
          </div>

          {nextStreakMilestone && daysToNext && daysToNext > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {daysToNext} kun → 
              </span>
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Gift className="h-3 w-3" />
                {nextStreakMilestone.bonus_fixed.toLocaleString()} so'm
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
