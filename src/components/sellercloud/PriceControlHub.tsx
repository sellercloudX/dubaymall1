import { lazy, Suspense, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Shield } from 'lucide-react';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

const PriceManager = lazy(() => import('@/components/sellercloud/PriceManager').then(m => ({ default: m.PriceManager })));
const MinPriceProtection = lazy(() => import('@/components/sellercloud/MinPriceProtection').then(m => ({ default: m.MinPriceProtection })));

interface Props {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

function TabLoader() {
  return <div className="space-y-3 py-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full rounded-lg" /></div>;
}

export function PriceControlHub({ connectedMarketplaces, store }: Props) {
  const [tab, setTab] = useState('manager');

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="manager" className="flex-1 gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Narxlar
        </TabsTrigger>
        <TabsTrigger value="protection" className="flex-1 gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Min narx himoya
        </TabsTrigger>
      </TabsList>
      <TabsContent value="manager" className="mt-4">
        <Suspense fallback={<TabLoader />}>
          <PriceManager connectedMarketplaces={connectedMarketplaces} store={store} />
        </Suspense>
      </TabsContent>
      <TabsContent value="protection" className="mt-4">
        <Suspense fallback={<TabLoader />}>
          <MinPriceProtection connectedMarketplaces={connectedMarketplaces} store={store} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
