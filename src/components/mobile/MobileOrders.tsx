import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShoppingCart, RefreshCw, User, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MobileOrdersProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const MARKETPLACE_EMOJI: Record<string, string> = {
  yandex: '🟡',
  uzum: '🟣',
  wildberries: '🔵',
  ozon: '🟢',
};

const ORDER_STATUSES = [
  { value: 'all', label: 'Barchasi' },
  { value: 'PROCESSING', label: 'Jarayonda' },
  { value: 'DELIVERY', label: 'Yetkazilmoqda' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'CANCELLED', label: 'Bekor' },
];

export function MobileOrders({ connectedMarketplaces, fetchMarketplaceData }: MobileOrdersProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMp, setSelectedMp] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMp) {
      setSelectedMp(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces]);

  useEffect(() => {
    if (selectedMp) loadOrders();
  }, [selectedMp, statusFilter]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const options: Record<string, any> = { fetchAll: true };
      if (statusFilter !== 'all') options.status = statusFilter;
      
      const result = await fetchMarketplaceData(selectedMp, 'orders', options);
      if (result.success) {
        setOrders(result.data || []);
        setTotal(result.total || result.data?.length || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PROCESSING: { variant: 'secondary', label: 'Jarayonda' },
      DELIVERY: { variant: 'default', label: 'Yetkazilmoqda' },
      DELIVERED: { variant: 'default', label: 'Yetkazildi' },
      CANCELLED: { variant: 'destructive', label: 'Bekor' },
    };
    const c = config[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={c.variant} className="text-[10px]">{c.label}</Badge>;
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
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-14 bg-background z-30 px-3 py-3 border-b space-y-2.5">
        {/* Marketplace Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 scrollbar-hide">
          {connectedMarketplaces.map(mp => (
            <Button
              key={mp}
              variant={selectedMp === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMp(mp)}
              className="shrink-0 text-xs h-8 px-3"
            >
              {MARKETPLACE_EMOJI[mp]} {mp}
            </Button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadOrders} disabled={isLoading} className="shrink-0 h-9 w-9">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {total > 0 && (
          <div className="text-xs text-muted-foreground">
            {orders.length} / {total} buyurtma
          </div>
        )}
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-24" />
              </CardContent>
            </Card>
          ))
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Buyurtmalar topilmadi</p>
          </div>
        ) : (
          orders.map((order) => (
            <Card 
              key={order.id} 
              className="overflow-hidden cursor-pointer active:bg-muted/50"
              onClick={() => setSelectedOrder(order)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1.5 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">#{order.id}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(order.status)}
                  </div>
                </div>

                {order.buyer && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5 truncate">
                    <User className="h-3 w-3" />
                    {order.buyer.firstName} {order.buyer.lastName}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-primary text-sm">
                      {formatPrice(order.totalUZS || order.total)}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">
                      ({order.items?.length || 0} mahsulot)
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto mx-4">
          <DialogHeader>
            <DialogTitle className="text-base truncate pr-8">Buyurtma #{selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          
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
                  <span className="font-medium">
                    {selectedOrder.buyer.firstName} {selectedOrder.buyer.lastName}
                  </span>
                </div>
              )}

              {/* Order Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Mahsulotlar:</h4>
                  {selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between p-3 bg-muted rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium line-clamp-2">{item.offerName}</div>
                        <div className="text-xs text-muted-foreground">× {item.count}</div>
                      </div>
                      <div className="font-medium text-right">
                        {formatPrice(item.priceUZS || item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
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
                  <span className="text-primary">
                    {formatPrice(selectedOrder.totalUZS || selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
