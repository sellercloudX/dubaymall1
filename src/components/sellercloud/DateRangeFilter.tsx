import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, startOfYear } from 'date-fns';
import { cn } from '@/lib/utils';

export type DatePreset = '7d' | '30d' | '90d' | 'month' | 'year' | 'all' | 'custom';

interface DateRangeFilterProps {
  from: Date | undefined;
  to: Date | undefined;
  onRangeChange: (from: Date | undefined, to: Date | undefined, preset: DatePreset) => void;
  activePreset: DatePreset;
}

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: '7d', label: '7 kun' },
  { id: '30d', label: '30 kun' },
  { id: '90d', label: '90 kun' },
  { id: 'month', label: 'Bu oy' },
  { id: 'year', label: 'Bu yil' },
  { id: 'all', label: 'Hammasi' },
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

export function DateRangeFilter({ from, to, onRangeChange, activePreset }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<'from' | 'to'>('from');

  const handlePreset = (preset: DatePreset) => {
    const { from: f, to: t } = getPresetDates(preset);
    onRangeChange(f, t, preset);
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    if (calendarMode === 'from') {
      onRangeChange(date, to || new Date(), 'custom');
      setCalendarMode('to');
    } else {
      onRangeChange(from, date, 'custom');
      setCalendarOpen(false);
      setCalendarMode('from');
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(p => (
        <Button
          key={p.id}
          variant={activePreset === p.id ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs px-2.5"
          onClick={() => handlePreset(p.id)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePreset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5 gap-1"
          >
            <CalendarIcon className="h-3 w-3" />
            {activePreset === 'custom' && from && to ? (
              `${format(from, 'dd.MM')} — ${format(to, 'dd.MM')}`
            ) : (
              'Tanlash'
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
            disabled={(date) => date > new Date()}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {activePreset === 'custom' && from && to && (
        <Badge variant="outline" className="text-[10px]">
          {format(from, 'dd.MM.yyyy')} — {format(to, 'dd.MM.yyyy')}
        </Badge>
      )}
    </div>
  );
}
