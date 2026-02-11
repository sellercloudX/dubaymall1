import { BarChart3, Scan, Package, ShoppingCart, MoreHorizontal, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTabType = 
  | 'marketplaces' | 'analytics' | 'scanner' | 'products' | 'orders' 
  | 'abc-analysis' | 'min-price' | 'card-clone' | 'problems' 
  | 'financials' | 'calculator' | 'inventory' | 'pricing' | 'publish' 
  | 'reports' | 'notifications' | 'subscription' | 'cost-prices';

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
                  if (!isMoreActive) {
                    onTabChange('financials');
                  }
                } else {
                  onTabChange(item.id as MobileTabType);
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
