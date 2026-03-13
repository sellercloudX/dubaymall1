import { cn } from '@/lib/utils';
import {
  Globe, Package, ShoppingCart, BarChart3, Scan,
  ArrowDownUp, DollarSign, Bell, FileSpreadsheet, CreditCard, Receipt,
  Calculator, Shield, Copy, AlertOctagon,
  MessageCircle, Activity, Megaphone, ChevronLeft, ChevronRight,
  LogOut, LayoutDashboard, Sun, Moon, Wallet, Search,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MarketplaceLogo, MARKETPLACE_CONFIG } from '@/lib/marketplaceConfig';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserBalance, MIN_TOPUP_UZS } from '@/hooks/useFeaturePricing';

export interface SellerMenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  group: 'main' | 'analytics' | 'tools' | 'settings';
}

export const sellerMenuItems: SellerMenuItem[] = [
  { id: 'marketplaces', label: 'Marketplacelar', icon: Globe, group: 'main' },
  { id: 'stores', label: 'Do\'konlar', icon: LayoutDashboard, group: 'main' },
  { id: 'scanner', label: 'AI Scanner', icon: Scan, group: 'main' },
  { id: 'products', label: 'Mahsulotlar', icon: Package, group: 'main' },
  { id: 'orders', label: 'Buyurtmalar', icon: ShoppingCart, group: 'main' },
  { id: 'sales', label: 'Sotuvlar', icon: DollarSign, group: 'main' },
  { id: 'product-analytics', label: 'Mahsulot analitika', icon: BarChart3, group: 'analytics' },
  { id: 'wb-analytics', label: 'Sotuvchi analitika', icon: Activity, group: 'analytics' },
  { id: 'seo-monitor', label: 'SEO Monitor', icon: Search, group: 'analytics' },
  { id: 'wb-keywords', label: 'Qidiruv so\'zlari', icon: Search, group: 'analytics' },
  { id: 'financials', label: 'Moliya', icon: Calculator, group: 'analytics' },
  { id: 'unit-economy', label: 'Unit-economy', icon: Receipt, group: 'analytics' },
  { id: 'abc', label: 'ABC-analiz', icon: BarChart3, group: 'analytics' },
  { id: 'cost-prices', label: 'Tannarx', icon: DollarSign, group: 'analytics' },
  { id: 'calculator', label: 'Kalkulyator', icon: Calculator, group: 'analytics' },
  { id: 'competitor', label: 'Raqobat narx', icon: ArrowDownUp, group: 'tools' },
  { id: 'stock-forecast', label: 'Zaxira prognoz', icon: Activity, group: 'tools' },
  { id: 'auto-reorder', label: 'Avto buyurtma', icon: ShoppingCart, group: 'tools' },
  { id: 'inventory', label: 'Zaxira sinxron', icon: ArrowDownUp, group: 'tools' },
  { id: 'pricing', label: 'Narxlar', icon: DollarSign, group: 'tools' },
  { id: 'reviews', label: 'Sharhlar', icon: MessageCircle, group: 'tools' },
  { id: 'ads', label: 'Reklama', icon: Megaphone, group: 'tools' },
  { id: 'min-price', label: 'Min narx himoya', icon: Shield, group: 'tools' },
  { id: 'clone', label: 'Klonlash', icon: Copy, group: 'tools' },
  { id: 'problems', label: 'Muammolar', icon: AlertOctagon, group: 'tools' },
  { id: 'mxik', label: 'MXIK baza', icon: FileSpreadsheet, group: 'tools' },
  { id: 'uzum-dashboard', label: 'Uzum Pro', icon: LayoutDashboard, group: 'tools' },
  { id: 'team', label: 'Jamoa', icon: Globe, group: 'settings' },
  { id: 'subscription', label: 'Obuna', icon: CreditCard, group: 'settings' },
  { id: 'reports', label: 'Hisobotlar', icon: FileSpreadsheet, group: 'settings' },
  { id: 'notifications', label: 'Bildirishnoma', icon: Bell, group: 'settings' },
  { id: 'support', label: 'Yordam', icon: MessageCircle, group: 'settings' },
];

const groupLabels: Record<string, string> = {
  main: 'Asosiy',
  analytics: 'Analitika',
  tools: 'Asboblar',
  settings: 'Sozlamalar',
};

interface SellerCloudSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  connectedMarketplaces: string[];
}

export function SellerCloudSidebar({ activeTab, onTabChange, connectedMarketplaces }: SellerCloudSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { balance } = useUserBalance();

  const groups = ['main', 'analytics', 'tools', 'settings'] as const;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card h-screen sticky top-0 transition-all duration-300 ease-in-out z-30",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header with collapse button */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-16 border-b border-border shrink-0",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shrink-0">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold truncate text-foreground">SellerCloudX</h2>
            <p className="text-[11px] text-muted-foreground truncate">Pro kabinet</p>
          </div>
        )}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {collapsed ? 'Kengaytirish' : 'Yig\'ish'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Connected marketplaces */}
      {!collapsed && connectedMarketplaces.length > 0 && (
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ulangan</p>
          <div className="flex flex-wrap gap-1.5">
            {connectedMarketplaces.map(mp => (
              <div key={mp} className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 border border-border/50">
                <MarketplaceLogo marketplace={mp} size={14} />
                <span className="text-[10px] font-medium text-muted-foreground">{MARKETPLACE_CONFIG[mp]?.name || mp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
        {groups.map((group, gi) => {
          const groupItems = sellerMenuItems.filter(item => item.group === group);
          return (
            <div key={group}>
              {gi > 0 && <Separator className="my-3" />}
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabels[group]}
                </p>
              )}
              {groupItems.map(item => {
                const isActive = activeTab === item.id;
                const btn = (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "text-primary-foreground")} />
                    {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
                  </button>
                );

              if (collapsed) {
                  return (
                    <Tooltip key={item.id} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div>{btn}</div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return <div key={item.id}>{btn}</div>;
              })}
            </div>
          );
        })}
      </nav>

      {/* Balance widget */}
      {!collapsed && (
        <div className="shrink-0 border-t border-border px-3 py-2.5">
          <button
            onClick={() => onTabChange('subscription')}
            className="w-full rounded-lg bg-primary/5 border border-primary/20 p-2.5 hover:bg-primary/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Balans</span>
            </div>
            <p className="text-base font-bold text-foreground">
              {balance ? Number(balance.balance_uzs).toLocaleString() : '0'} <span className="text-xs font-normal text-muted-foreground">UZS</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Min. to'ldirish: {MIN_TOPUP_UZS.toLocaleString()} so'm
            </p>
          </button>
        </div>
      )}
      {collapsed && (
        <div className="shrink-0 border-t border-border p-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTabChange('subscription')}
                className="w-full flex items-center justify-center py-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
              >
                <Wallet className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Balans: {balance ? Number(balance.balance_uzs).toLocaleString() : '0'} UZS
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        {/* Dark mode toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
              )}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
              {!collapsed && <span className="text-[13px]">{resolvedTheme === 'dark' ? 'Yorug\' rejim' : 'Qorong\'i rejim'}</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">{resolvedTheme === 'dark' ? 'Yorug\' rejim' : 'Qorong\'i rejim'}</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate('/')}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
              )}
            >
              <Globe className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="text-[13px]">Bosh sahifa</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">Bosh sahifa</TooltipContent>}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={handleSignOut}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors",
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
              )}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="text-[13px]">Chiqish</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right" className="text-xs">Chiqish</TooltipContent>}
        </Tooltip>
      </div>
    </aside>
  );
}
