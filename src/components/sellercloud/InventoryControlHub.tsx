import { lazy, Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, ShoppingCart } from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

const StockForecast = lazy(() => import('@/components/sellercloud/StockForecast').then(m => ({ default: m.StockForecast })));
const AutoReorderAlerts = lazy(() => import('@/components/sellercloud/AutoReorderAlerts').then(m => ({ default: m.AutoReorderAlerts })));

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

function TabLoader() {
  return <div className="space-y-3 py-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full rounded-lg" /></div>;
}

export function InventoryControlHub({ connectedMarketplaces, store }: Props) {
  const [tab, setTab] = useState('forecast');

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="forecast" className="flex-1 gap-1.5">
          <TrendingDown className="h-3.5 w-3.5" />
          Prognoz
        </TabsTrigger>
        <TabsTrigger value="reorder" className="flex-1 gap-1.5">
          <ShoppingCart className="h-3.5 w-3.5" />
          Avto buyurtma
        </TabsTrigger>
      </TabsList>
      <TabsContent value="forecast" className="mt-4">
        <Suspense fallback={<TabLoader />}>
          <StockForecast connectedMarketplaces={connectedMarketplaces} store={store} />
        </Suspense>
      </TabsContent>
      <TabsContent value="reorder" className="mt-4">
        <Suspense fallback={<TabLoader />}>
          <AutoReorderAlerts connectedMarketplaces={connectedMarketplaces} store={store} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
