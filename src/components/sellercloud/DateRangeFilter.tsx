import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Lock } from 'lucide-react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDataRetention } from '@/hooks/useDataRetention';

export type DatePreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'all' | 'custom';

interface DateRangeFilterProps {
  from: Date | undefined;
  to: Date | undefined;
  onRangeChange: (from: Date | undefined, to: Date | undefined, preset: DatePreset) => void;
  activePreset: DatePreset;
  /** Override max days (if not set, auto-detected from subscription) */
  maxDays?: number;
}

const ALL_PRESETS: { id: DatePreset; label: string; days: number }[] = [
  { id: '7d', label: '7 kun', days: 7 },
  { id: '30d', label: '30 kun', days: 30 },
  { id: '90d', label: '90 kun', days: 90 },
  { id: 'month', label: 'Bu oy', days: 31 },
  { id: 'year', label: 'Bu yil', days: 365 },
  { id: 'all', label: 'Hammasi', days: 9999 },
];

export function getPresetDates(preset: DatePreset): { from: Date | undefined; to: Date | undefined } {
  const now = new Date();
  switch (preset) {
    case '7d': return { from: subDays(now, 7), to: now };
    case '30d': return { from: subDays(now, 30), to: now };
    case '90d': return { from: subDays(now, 90), to: now };
    case 'month': return { from: startOfMonth(now), to: now };
    case 'year': return { from: startOfYear(now), to: now };
    case 'all': return { from: undefined, to: undefined };
    default: return { from: undefined, to: undefined };
  }
}

export function DateRangeFilter({ from, to, onRangeChange, activePreset, maxDays: maxDaysProp }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'from' | 'to'>('from');
  const retentionDays = useDataRetention();
  const maxDays = maxDaysProp ?? retentionDays;

  // Split presets: allowed vs locked
  const allowedPresets = ALL_PRESETS.filter(p => p.days <= maxDays);
  const lockedPresets = ALL_PRESETS.filter(p => p.days > maxDays);

  const handlePreset = (preset: DatePreset) => {
    const { from: f, to: t } = getPresetDates(preset);
    onRangeChange(f, t, preset);
  };

  // Enforce calendar min date based on retention
  const minCalendarDate = subDays(new Date(), maxDays);

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    // Clamp to retention limit
    const clamped = date < minCalendarDate ? minCalendarDate : date;
    if (calendarMode === 'from') {
      onRangeChange(clamped, to || new Date(), 'custom');
      setCalendarMode('to');
    } else {
      onRangeChange(from, clamped, 'custom');
      setCalendarOpen(false);
      setCalendarMode('from');
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {allowedPresets.map(p => (
        <Button
          key={p.id}
          variant={activePreset === p.id ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-[11px] px-2.5 rounded-full"
          onClick={() => handlePreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
      {lockedPresets.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] px-2.5 rounded-full opacity-50 cursor-not-allowed gap-1"
          disabled
          title="Tarifni oshiring — ko'proq tarixiy ma'lumot oling"
        >
          <Lock className="h-3 w-3" />
          {lockedPresets[0].label}+
        </Button>
      )}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-[11px] px-2.5 gap-1 rounded-full"
          >
            <CalendarIcon className="h-3 w-3 md:h-4 md:w-4" />
            {activePreset === 'custom' && from && to ? (
              `${format(from, 'dd.MM')} — ${format(to, 'dd.MM')}`
            ) : (
              '📅'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-2 text-xs text-center text-muted-foreground border-b">
            {calendarMode === 'from' ? 'Boshlanish sanasi' : 'Tugash sanasi'}
          </div>
          <Calendar
            mode="single"
            selected={calendarMode === 'from' ? from : to}
            onSelect={handleCalendarSelect}
            disabled={(date) => date > new Date() || date < minCalendarDate}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {activePreset === 'custom' && from && to && (
        <Badge variant="outline" className="text-[10px] md:text-xs">
          {format(from, 'dd.MM.yyyy')} — {format(to, 'dd.MM.yyyy')}
        </Badge>
      )}
    </div>
  );
}
