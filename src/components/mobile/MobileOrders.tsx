import { useState, useMemo, useRef, memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, RefreshCw, User, ChevronRight, WifiOff, Clock, Package } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { MarketplaceDataStore, MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';

interface MobileOrdersProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡', uzum: '🟣', wildberries: '🔵', ozon: '🟢',
};

const ORDER_STATUSES = [
  { value: 'all', label: 'Barchasi' },
  { value: 'PROCESSING', label: 'Jarayonda' },
  { value: 'DELIVERY', label: 'Yetkazilmoqda' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'CANCELLED', label: 'Bekor' },
];

const formatPrice = (price?: number) => {
  if (!price) return '—';
  if (price >= 1000000) return (price / 1000000).toFixed(1) + ' mln';
  return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
};

const formatDate = (dateStr: string) => {
  try {
    if (!dateStr) return '—';
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
      const parsed = parse(dateStr, 'dd-MM-yyyy HH:mm:ss', new Date());
      if (isValid(parsed)) return format(parsed, 'dd.MM.yyyy');
    }
    const date = new Date(dateStr);
    if (isValid(date)) return format(date, 'dd.MM.yyyy');
    return dateStr;
  } catch { return dateStr; }
};

const formatTime = (dateStr: string) => {
  try {
    if (!dateStr) return '';
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 2) {
      const parsed = parse(dateStr, 'dd-MM-yyyy HH:mm:ss', new Date());
      if (isValid(parsed)) return format(parsed, 'HH:mm');
    }
    const date = new Date(dateStr);
    if (isValid(date)) return format(date, 'HH:mm');
    return '';
  } catch { return ''; }
};

const getStatusBadge = (status: string) => {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
    PROCESSING: { variant: 'secondary', label: 'Jarayonda' },
    DELIVERY: { variant: 'default', label: 'Yetkazilmoqda' },
    PICKUP: { variant: 'default', label: 'Olib ketish' },
    DELIVERED: { variant: 'outline', label: 'Yetkazildi', className: 'border-green-500 text-green-600' },
    CANCELLED: { variant: 'destructive', label: 'Bekor' },
    RETURNED: { variant: 'destructive', label: 'Qaytarildi' },
  };
  const c = config[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={c.variant} className={`text-[10px] ${c.className || ''}`}>{c.label}</Badge>;
};

const getFirstProductName = (order: MarketplaceOrder): string => {
  if (!order.items || order.items.length === 0) return 'Mahsulot nomi yuklanmadi';
  const firstName = order.items[0].offerName || order.items[0].offerId || '';
  return firstName.length > 40 ? firstName.substring(0, 40) + '...' : firstName;
};

const OrderRow = memo(({ order, onClick, store, marketplace }: { order: MarketplaceOrder; onClick: (o: MarketplaceOrder) => void; store: MarketplaceDataStore; marketplace: string }) => {
  const productName = getFirstProductName(order);
  const itemCount = order.items?.length || 0;
  const totalPrice = order.itemsTotalUZS || order.itemsTotal || order.totalUZS || order.total || 0;
  
  // Get product image: first from order item photo, then from store products
  const firstItem = order.items?.[0];
  const itemPhoto = firstItem?.photo;
  const matchedProduct = firstItem ? store.getProducts(marketplace).find(p => p.offerId === firstItem.offerId) : null;
  const imgUrl = itemPhoto || matchedProduct?.pictures?.[0];
  
  return (
    <Card className="overflow-hidden cursor-pointer active:bg-muted/50 mx-3 border-l-4 border-l-primary/30" onClick={() => onClick(order)}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-primary">#{order.id}</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDate(order.createdAt)} {formatTime(order.createdAt)}
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge(order.status)}</div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
            {imgUrl ? (
              <img src={imgUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium line-clamp-2">{productName}</div>
            {itemCount > 1 && <span className="text-[10px] text-muted-foreground">+{itemCount - 1} ta boshqa mahsulot</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-dashed">
          {order.buyer ? (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0 flex-1 truncate">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.buyer.firstName} {order.buyer.lastName}</span>
            </div>
          ) : <div className="flex-1" />}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-primary text-sm">{formatPrice(totalPrice)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
OrderRow.displayName = 'OrderRow';

export function MobileOrders({ connectedMarketplaces, store }: MobileOrdersProps) {
  const [selectedMp, setSelectedMp] = useState(connectedMarketplaces[0] || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<MarketplaceOrder | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const isOnline = navigator.onLine;

  const isLoading = store.isLoadingOrders;
  const isFetching = store.isFetching;

  // Get orders from centralized store
  const orders = useMemo(() => {
    const allOrders = selectedMp ? store.getOrders(selectedMp) : store.allOrders;
    if (statusFilter === 'all') return allOrders;
    return allOrders.filter(o => o.status === statusFilter);
  }, [selectedMp, statusFilter, store.dataVersion]);

  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130,
    overscan: 5,
  });

  const handleRefresh = () => {
    if (!isOnline) { toast.error('Internet aloqasi yo\'q'); return; }
    toast.info('Buyurtmalar yangilanmoqda...');
    store.refetchOrders(selectedMp || undefined);
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <div className="p-4 text-center">
        <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">Marketplace ulanmagan</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] bg-background z-30 px-3 py-3 border-b space-y-2.5">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          {connectedMarketplaces.map(mp => (
            <Button key={mp} variant={selectedMp === mp ? 'default' : 'outline'} size="sm"
              onClick={() => setSelectedMp(mp)} className="shrink-0 text-xs h-8 px-3">
              {MARKETPLACE_EMOJI[mp]} {mp}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 h-9 text-sm"><SelectValue placeholder="Holat" /></SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading || isFetching} className="shrink-0 h-9 w-9">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{orders.length} ta buyurtma</span>
          {!isOnline && <span className="text-amber-600 inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> Offline</span>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3 space-y-2">
              <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-16" /></div>
              <Skeleton className="h-3 w-1/2" /><Skeleton className="h-5 w-24" />
            </CardContent></Card>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mb-3 opacity-50" /><p>Buyurtmalar topilmadi</p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-y-auto py-3" style={{ contain: 'strict' }}>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const order = orders[virtualItem.index];
              return (
                <div key={order.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)`, paddingBottom: '8px' }}>
                  <OrderRow order={order} onClick={setSelectedOrder} store={store} marketplace={selectedMp} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto mx-4">
          <DialogHeader><DialogTitle className="text-base truncate pr-8">Buyurtma #{selectedOrder?.id}</DialogTitle></DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Holat:</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sana:</span>
                <span className="font-medium">{formatDate(selectedOrder.createdAt)}</span>
              </div>
              {selectedOrder.buyer && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Haridor:</span>
                  <span className="font-medium">{selectedOrder.buyer.firstName} {selectedOrder.buyer.lastName}</span>
                </div>
              )}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Mahsulotlar:</h4>
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-3 bg-muted rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium line-clamp-2">{item.offerName}</div>
                        <div className="text-xs text-muted-foreground">× {item.count}</div>
                      </div>
                      <div className="font-medium text-right">{formatPrice(item.priceUZS || item.price)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mahsulotlar:</span>
                  <span>{formatPrice(selectedOrder.itemsTotalUZS || selectedOrder.itemsTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Yetkazish:</span>
                  <span>{formatPrice(selectedOrder.deliveryTotalUZS || selectedOrder.deliveryTotal)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Jami:</span>
                  <span className="text-primary">{formatPrice(selectedOrder.totalUZS || selectedOrder.total)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
