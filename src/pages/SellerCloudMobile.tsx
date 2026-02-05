import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceConnections } from '@/hooks/useMarketplaceConnections';
import { useSellerCloudSubscription } from '@/hooks/useSellerCloudSubscription';
import { MobileSellerCloudNav } from '@/components/mobile/MobileSellerCloudNav';
import { MobileSellerCloudHeader } from '@/components/mobile/MobileSellerCloudHeader';
import { MobileAnalytics } from '@/components/mobile/MobileAnalytics';
import { MobileProducts } from '@/components/mobile/MobileProducts';
import { MobileOrders } from '@/components/mobile/MobileOrders';
 import { MobileTrendHunter } from '@/components/mobile/MobileTrendHunter';
import { AIScannerPro } from '@/components/seller/AIScannerPro';
 import { BackgroundTasksPanel } from '@/components/mobile/BackgroundTasksPanel';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

 type TabType = 'analytics' | 'scanner' | 'products' | 'orders' | 'trends';

export default function SellerCloudMobile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  
  const { 
    connections, 
    isLoading: connectionsLoading,
    fetchMarketplaceData,
    refetch
  } = useMarketplaceConnections();
  
  const {
    subscription,
    accessStatus,
  } = useSellerCloudSubscription();
  
  const connectedMarketplaces = connections.map(c => c.marketplace);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth?redirect=/seller-cloud-mobile');
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show subscription required screen
  if (!subscription) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
          <Lock className="h-10 w-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">SellerCloudX Pro</h1>
        <p className="text-muted-foreground text-center mb-6">
          Barcha marketplacelarni bitta joydan boshqaring
        </p>
        <Button size="lg" onClick={() => navigate('/seller-cloud')}>
          Obuna bo'lish
        </Button>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/')}>
          Bosh sahifaga qaytish
        </Button>
      </div>
    );
  }

  // Access restricted
  if (accessStatus && !accessStatus.is_active) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Card className="border-destructive max-w-sm">
          <CardContent className="pt-6 text-center">
            <Lock className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Akkount cheklangan</h2>
            <p className="text-sm text-muted-foreground mb-4">{accessStatus.message}</p>
            <Button variant="destructive" onClick={() => navigate('/seller-cloud')}>
              To'lovga o'tish
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <MobileAnalytics 
            connections={connections}
            connectedMarketplaces={connectedMarketplaces}
          />
        );
      case 'scanner':
        return (
          <div className="p-4">
            <AIScannerPro shopId="sellercloud" />
          </div>
        );
      case 'products':
        return (
          <MobileProducts
            connectedMarketplaces={connectedMarketplaces}
          />
        );
      case 'orders':
        return (
          <MobileOrders
            connectedMarketplaces={connectedMarketplaces}
          />
        );
       case 'trends':
         return <MobileTrendHunter />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16 overflow-x-hidden">
      <MobileSellerCloudHeader 
        connectedCount={connectedMarketplaces.length}
        onRefresh={refetch}
        isLoading={connectionsLoading}
      />
      
      <main className="pt-14">
        {renderContent()}
      </main>
      
      <MobileSellerCloudNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
       
       {/* Background Tasks Panel */}
       <BackgroundTasksPanel />
    </div>
  );
}
