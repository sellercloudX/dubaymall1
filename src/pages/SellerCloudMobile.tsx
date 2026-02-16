import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { useMarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';
import { MobileSellerCloudNav, type MobileTabType } from '@/components/mobile/MobileSellerCloudNav';
import { MobileSellerCloudHeader } from '@/components/mobile/MobileSellerCloudHeader';
import { MobileAnalytics } from '@/components/mobile/MobileAnalytics';
import { MobileProducts } from '@/components/mobile/MobileProducts';
import { MobileOrders } from '@/components/mobile/MobileOrders';

import { AIScannerPro } from '@/components/seller/AIScannerPro';
import { BackgroundTasksPanel } from '@/components/mobile/BackgroundTasksPanel';
import { ABCAnalysis } from '@/components/sellercloud/ABCAnalysis';
import { MinPriceProtection } from '@/components/sellercloud/MinPriceProtection';
import { CardCloner } from '@/components/sellercloud/CardCloner';
import { ProblematicProducts } from '@/components/sellercloud/ProblematicProducts';
import { FinancialDashboard } from '@/components/sellercloud/FinancialDashboard';
import { ProfitCalculator } from '@/components/sellercloud/ProfitCalculator';
import { MarketplaceOAuth } from '@/components/sellercloud/MarketplaceOAuth';
import { InventorySync } from '@/components/sellercloud/InventorySync';
import { PriceManager } from '@/components/sellercloud/PriceManager';

import { ReportsExport } from '@/components/sellercloud/ReportsExport';
import { NotificationCenter } from '@/components/sellercloud/NotificationCenter';
import { SubscriptionBilling } from '@/components/sellercloud/SubscriptionBilling';
import { CostPriceManager } from '@/components/sellercloud/CostPriceManager';
import { UzumCardHelper } from '@/components/sellercloud/UzumCardHelper';
import { Loader2, Lock, TrendingUp, Calculator, DollarSign, BarChart3, Shield, Copy, AlertOctagon, ArrowDownUp, Tag, Upload, FileSpreadsheet, Bell, CreditCard, Coins, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const moreSubTabs = [
  { id: 'financials' as const, icon: DollarSign, label: 'Moliya' },
  { id: 'calculator' as const, icon: Calculator, label: 'Kalkulyator' },
  { id: 'abc-analysis' as const, icon: BarChart3, label: 'ABC-analiz' },
  { id: 'cost-prices' as const, icon: Coins, label: 'Tannarx' },
  { id: 'min-price' as const, icon: Shield, label: 'Min narx' },
  { id: 'card-clone' as const, icon: Copy, label: 'Klonlash' },
  { id: 'uzum-card' as const, icon: Sparkles, label: 'Uzum Card' },
  { id: 'problems' as const, icon: AlertOctagon, label: 'Muammolar' },
  { id: 'inventory' as const, icon: ArrowDownUp, label: 'Zaxira' },
  { id: 'pricing' as const, icon: Tag, label: 'Narxlar' },
  { id: 'publish' as const, icon: Upload, label: 'Joylash' },
  { id: 'reports' as const, icon: FileSpreadsheet, label: 'Hisobotlar' },
  { id: 'notifications' as const, icon: Bell, label: 'Bildirishnoma' },
  { id: 'subscription' as const, icon: CreditCard, label: 'Obuna' },
];

const primaryTabIds: MobileTabType[] = ['marketplaces', 'analytics', 'scanner', 'products', 'orders'];

export default function SellerCloudMobile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MobileTabType>('analytics');
  
  const { 
    connections, 
    isLoading: connectionsLoading,
    connectMarketplace,
    disconnectMarketplace,
    syncMarketplace,
    refetch
  } = useMarketplaceConnections();
  
  const {
    subscription,
    accessStatus,
    isLoading: subscriptionLoading,
    createSubscription,
  } = useSellerCloudSubscription();
  
   const connectedMarketplaces = connections.map(c => c.marketplace);
   const totalRevenue = connections.reduce((sum, c) => sum + (c.total_revenue || 0), 0);
   
   // Centralized data store — fetches once, cached for all tabs
   const store = useMarketplaceDataStore(connectedMarketplaces);

  const handleMarketplaceConnect = async () => {
    await refetch();
    toast.success('Marketplace ma\'lumotlari yangilandi');
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud-mobile');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">SellerCloudX Pro</h1>
        <p className="text-muted-foreground text-center mb-6">Barcha marketplacelarni bitta joydan boshqaring</p>
        <Button size="lg" onClick={async () => {
          const result = await createSubscription('pro');
          if (result.success) {
            toast.success('Obuna so\'rovi yuborildi! Admin tasdiqlashini kuting.');
          } else {
            toast.error(result.error || 'Xatolik yuz berdi');
          }
        }}>Obuna bo'lish</Button>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>Bosh sahifaga qaytish</Button>
      </div>
    );
  }

  if (accessStatus && !accessStatus.is_active) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="border-destructive max-w-sm w-full"><CardContent className="pt-6 text-center space-y-4">
          <Lock className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Akkount cheklangan</h2>
          <p className="text-sm text-muted-foreground">{accessStatus.message}</p>
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Nima qilish kerak?</p>
            <ul className="text-xs text-muted-foreground space-y-1 text-left">
              <li>1. To'lov qiling — avtomatik aktivlashadi</li>
              <li>2. Yoki admin bilan bog'laning</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" onClick={() => setActiveTab('subscription' as any)}>To'lov qilish</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate('/')}>Bosh sahifa</Button>
          </div>
        </CardContent></Card>
      </div>
    );
  }

  const isMoreActive = !primaryTabIds.includes(activeTab);

  const renderContent = () => {
    switch (activeTab) {
      case 'marketplaces':
        return (
          <div className="p-4">
            <MarketplaceOAuth 
              connections={connections} 
              isLoading={connectionsLoading} 
              connectMarketplace={connectMarketplace} 
              disconnectMarketplace={disconnectMarketplace}
              syncMarketplace={syncMarketplace} 
              onConnect={handleMarketplaceConnect}
              store={store}
            />
          </div>
        );
      case 'analytics':
        return <MobileAnalytics connections={connections} connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'scanner':
        return <div className="p-4"><AIScannerPro shopId="sellercloud" /></div>;
      case 'products':
        return <MobileProducts connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'orders':
        return <MobileOrders connectedMarketplaces={connectedMarketplaces} store={store} />;
      case 'abc-analysis':
        return <div className="p-4"><ABCAnalysis connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'cost-prices':
        return <div className="p-4"><CostPriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'min-price':
        return <div className="p-4"><MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'card-clone':
        return <div className="p-4"><CardCloner connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'uzum-card':
        return <div className="p-4"><UzumCardHelper connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'problems':
        return <div className="p-4"><ProblematicProducts connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'financials':
        return <div className="p-4"><FinancialDashboard connectedMarketplaces={connectedMarketplaces} store={store} monthlyFee={subscription?.monthly_fee || 499} commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'calculator':
        return <div className="p-4"><ProfitCalculator commissionPercent={subscription?.commission_percent || 4} /></div>;
      case 'inventory':
        return <div className="p-4"><InventorySync connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'pricing':
        return <div className="p-4"><PriceManager connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'publish':
        return <div className="p-4 text-center text-muted-foreground">Bu funksiya olib tashlandi</div>;
      case 'reports':
        return <div className="p-4"><ReportsExport connectedMarketplaces={connectedMarketplaces} store={store} /></div>;
      case 'notifications':
        return <div className="p-4"><NotificationCenter /></div>;
      case 'subscription':
        return <div className="p-4"><SubscriptionBilling totalSalesVolume={totalRevenue} /></div>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32 overflow-x-hidden safe-area-bottom">
      <MobileSellerCloudHeader connectedCount={connectedMarketplaces.length} onRefresh={refetch} isLoading={connectionsLoading} />
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))]">
        {isMoreActive && (
          <div className="flex gap-2 px-3 py-2.5 overflow-x-auto no-scrollbar border-b bg-background/95 backdrop-blur-sm sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-40">
            {moreSubTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors min-h-[36px]",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />{tab.label}
                </button>
              );
            })}
          </div>
        )}
        <div className={isMoreActive ? "pt-1" : ""}>
          {renderContent()}
        </div>
      </main>
      <MobileSellerCloudNav activeTab={activeTab} onTabChange={setActiveTab} />
      <BackgroundTasksPanel />
    </div>
  );
}
