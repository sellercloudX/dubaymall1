import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { MobileTabType } from './MobileSellerCloudNav';
import {
  ArrowDownUp, DollarSign, Calculator, BarChart3, Shield, Copy,
  AlertOctagon, Tag, FileSpreadsheet, Bell, CreditCard, Coins,
  Sparkles, MessageCircle, Activity, Megaphone,
} from 'lucide-react';

interface MobileMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: MobileTabType;
  onTabChange: (tab: MobileTabType) => void;
}

type MenuCategory = {
  title: string;
  items: { id: MobileTabType; icon: React.ElementType; label: string; color: string }[];
};

const menuCategories: MenuCategory[] = [
  {
    title: '💰 Moliya',
    items: [
      { id: 'financials', icon: DollarSign, label: 'Moliya', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
      { id: 'calculator', icon: Calculator, label: 'Kalkulyator', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
      { id: 'cost-prices', icon: Coins, label: 'Tannarx', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
      { id: 'pricing', icon: Tag, label: 'Narxlar', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
    ],
  },
  {
    title: '📊 Analitika',
    items: [
      { id: 'abc-analysis', icon: BarChart3, label: 'ABC-analiz', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
      { id: 'seller-analytics', icon: Activity, label: 'WB Analitika', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
      { id: 'reviews', icon: MessageCircle, label: 'Sharhlar', color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
      { id: 'ads', icon: Megaphone, label: 'Reklama', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
    ],
  },
  {
    title: '🛠 Asboblar',
    items: [
      { id: 'inventory', icon: ArrowDownUp, label: 'Qoldiq', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
      { id: 'min-price', icon: Shield, label: 'Min narx', color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
      { id: 'card-clone', icon: Copy, label: 'Klonlash', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
      { id: 'uzum-card', icon: Sparkles, label: 'Uzum Card', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
      { id: 'problems', icon: AlertOctagon, label: 'Muammolar', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
      { id: 'mxik', icon: FileSpreadsheet, label: 'MXIK baza', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
    ],
  },
  {
    title: '⚙️ Tizim',
    items: [
      { id: 'reports', icon: FileSpreadsheet, label: 'Hisobotlar', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400' },
      { id: 'notifications', icon: Bell, label: 'Bildirishnoma', color: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
      { id: 'subscription', icon: CreditCard, label: 'Obuna', color: 'bg-primary/15 text-primary' },
    ],
  },
];

export function MobileMoreMenu({ open, onOpenChange, activeTab, onTabChange }: MobileMoreMenuProps) {
  const handleSelect = (id: MobileTabType) => {
    onTabChange(id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto px-5 pb-10 pt-0 [&>button]:hidden">
        {/* Drag handle */}
        <div className="sticky top-0 pt-3 pb-2 bg-background z-10">
          <div className="w-9 h-1 bg-muted-foreground/25 rounded-full mx-auto" />
        </div>

        <div className="space-y-6 pb-2">
          {menuCategories.map((cat, catIdx) => (
            <div key={cat.title}>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-0.5">
                {cat.title}
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all duration-200 active:scale-[0.92]',
                        isActive
                          ? 'bg-primary/10 shadow-sm'
                          : 'hover:bg-muted/60 active:bg-muted'
                      )}
                    >
                      <div className={cn(
                        'w-11 h-11 rounded-2xl flex items-center justify-center transition-transform duration-200',
                        item.color,
                        isActive && 'scale-110 shadow-sm'
                      )}>
                        <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                      </div>
                      <span className={cn(
                        'text-[10px] leading-tight text-center line-clamp-1 transition-colors',
                        isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'
                      )}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {catIdx < menuCategories.length - 1 && (
                <div className="border-b border-border/50 mt-5" />
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
