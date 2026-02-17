import { BarChart3, Scan, Package, ShoppingCart, MoreHorizontal, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTabType = 
  | 'marketplaces' | 'analytics' | 'scanner' | 'products' | 'orders' 
  | 'abc-analysis' | 'min-price' | 'card-clone' | 'uzum-card' | 'problems' 
  | 'financials' | 'calculator' | 'inventory' | 'pricing'
  | 'reports' | 'notifications' | 'subscription' | 'cost-prices' | 'quality-audit';

interface MobileSellerCloudNavProps {
  activeTab: MobileTabType;
  onTabChange: (tab: MobileTabType) => void;
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

export function MobileSellerCloudNav({ activeTab, onTabChange }: MobileSellerCloudNavProps) {
  const isMoreActive = !primaryTabIds.includes(activeTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t safe-area-bottom safe-area-left safe-area-right shadow-[0_-2px_10px_rgba(0,0,0,0.1)]" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)' }}>
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === 'more' ? isMoreActive : activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'more') {
                  if (!isMoreActive) {
                    onTabChange('financials');
                  }
                } else {
                  onTabChange(item.id as MobileTabType);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
                isActive && "bg-primary/10 scale-105"
              )}>
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-tight",
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
