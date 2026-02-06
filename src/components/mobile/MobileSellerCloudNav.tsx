import { BarChart3, Scan, Package, ShoppingCart, TrendingUp, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'analytics' | 'scanner' | 'products' | 'orders' | 'trends' | 'abc-analysis' | 'min-price' | 'card-clone' | 'problems';

interface MobileSellerCloudNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems = [
  { id: 'analytics' as const, icon: BarChart3, label: 'Analitika' },
  { id: 'scanner' as const, icon: Scan, label: 'Scanner' },
  { id: 'products' as const, icon: Package, label: 'Mahsulot' },
  { id: 'orders' as const, icon: ShoppingCart, label: 'Buyurtma' },
  { id: 'more' as const, icon: MoreHorizontal, label: "Ko'proq" },
];

const moreTabIds: TabType[] = ['trends', 'abc-analysis', 'min-price', 'card-clone', 'problems'];

export function MobileSellerCloudNav({ activeTab, onTabChange }: MobileSellerCloudNavProps) {
  const isMoreActive = moreTabIds.includes(activeTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'more' ? isMoreActive : activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'more') {
                  // Toggle to trends as default "more" tab, or cycle
                  if (!isMoreActive) {
                    onTabChange('trends');
                  }
                } else {
                  onTabChange(item.id as TabType);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                isActive && "bg-primary/10"
              )}>
                <Icon className={cn("h-4 w-4", isActive && "stroke-[2.5]")} />
              </div>
              <span className={cn(
                "text-[9px] font-medium leading-tight",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
