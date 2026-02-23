import { BarChart3, Scan, Package, ShoppingCart, MoreHorizontal, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTabType = 
  | 'marketplaces' | 'analytics' | 'scanner' | 'products' | 'orders' 
  | 'abc-analysis' | 'min-price' | 'card-clone' | 'uzum-card' | 'problems' 
  | 'financials' | 'calculator' | 'inventory' | 'pricing' | 'mxik'
  | 'reports' | 'notifications' | 'subscription' | 'cost-prices'
  | 'reviews' | 'seller-analytics' | 'ads';

interface MobileSellerCloudNavProps {
  activeTab: MobileTabType;
  onTabChange: (tab: MobileTabType) => void;
  onMorePress?: () => void;
}

const navItems = [
  { id: 'marketplaces' as const, icon: Globe, label: 'Marketplace' },
  { id: 'analytics' as const, icon: BarChart3, label: 'Analitika' },
  { id: 'scanner' as const, icon: Scan, label: 'Scanner' },
  { id: 'products' as const, icon: Package, label: 'Mahsulot' },
  { id: 'orders' as const, icon: ShoppingCart, label: 'Buyurtma' },
  { id: 'more' as const, icon: MoreHorizontal, label: "Ko'proq" },
];

const primaryTabIds: MobileTabType[] = ['marketplaces', 'analytics', 'scanner', 'products', 'orders'];

export function MobileSellerCloudNav({ activeTab, onTabChange, onMorePress }: MobileSellerCloudNavProps) {
  const isMoreActive = !primaryTabIds.includes(activeTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 safe-area-bottom safe-area-left safe-area-right" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}>
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'more' ? isMoreActive : activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'more') {
                  onMorePress?.();
                } else {
                  onTabChange(item.id as MobileTabType);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors relative",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {/* Active indicator dot */}
              {isActive && (
                <div className="absolute top-0.5 w-5 h-0.5 rounded-full bg-primary" />
              )}
              <Icon className={cn(
                "h-5 w-5 transition-all duration-150",
                isActive ? "stroke-[2.5] text-primary" : ""
              )} />
              <span className={cn(
                "text-[10px] leading-tight transition-colors",
                isActive ? "font-bold text-primary" : "font-medium text-muted-foreground"
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
