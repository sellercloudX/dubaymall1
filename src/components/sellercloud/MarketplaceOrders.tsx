import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ShoppingCart, RefreshCw, Loader2, ChevronDown, User, Package } from 'lucide-react';
import { format } from 'date-fns';
import type { MarketplaceDataStore } from '@/hooks/useMarketplaceDataStore';

interface MarketplaceOrdersProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

const ORDER_STATUSES = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'PROCESSING', label: 'Jarayonda' },
  { value: 'DELIVERY', label: 'Yetkazilmoqda' },
  { value: 'PICKUP', label: 'Olib ketish' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'COMPLETED', label: 'Yakunlandi' },
  { value: 'CANCELLED', label: 'Bekor qilindi' },
  { value: 'CANCELED', label: 'Bekor qilindi' },
  { value: 'PACKING', label: 'Yig\'ilmoqda' },
  { value: 'CREATED', label: 'Yangi' },
  { value: 'PENDING_DELIVERY', label: 'Yetkazishga tayyor' },
  { value: 'DELIVERING', label: 'Yetkazilmoqda' },
  { value: 'RETURNED', label: 'Qaytarildi' },
];

export function MarketplaceOrders({ connectedMarketplaces, store }: MarketplaceOrdersProps) {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMarketplace) {
      setSelectedMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  const allOrders = store.getOrders(selectedMarketplace);
  const isLoading = store.isLoadingOrders;

  // Client-side status filtering (no re-fetch needed)
  const orders = statusFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === statusFilter);
  const total = orders.length;

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ', { style: 'decimal', minimumFractionDigits: 0 }).format(price) + ' so\'m';
  };

  const getStatusBadge = (status: string, substatus?: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PROCESSING: { variant: 'secondary', label: 'Jarayonda' },
      DELIVERY: { variant: 'default', label: 'Yetkazilmoqda' },
      PICKUP: { variant: 'outline', label: 'Olib ketish' },
      DELIVERED: { variant: 'default', label: 'Yetkazildi' },
      COMPLETED: { variant: 'default', label: 'Yakunlandi' },
      CANCELLED: { variant: 'destructive', label: 'Bekor qilindi' },
      CANCELED: { variant: 'destructive', label: 'Bekor qilindi' },
      UNPAID: { variant: 'outline', label: 'To\'lanmagan' },
      // Uzum-specific statuses
      CREATED: { variant: 'outline', label: 'Yangi' },
      PACKING: { variant: 'secondary', label: 'Yig\'ilmoqda' },
      PENDING_DELIVERY: { variant: 'secondary', label: 'Yetkazishga tayyor' },
      DELIVERING: { variant: 'default', label: 'Yetkazilmoqda' },
      ACCEPTED_AT_DP: { variant: 'default', label: 'Qabul qilindi' },
      DELIVERED_TO_CUSTOMER_DELIVERY_POINT: { variant: 'default', label: 'Olib ketish punktida' },
      PENDING_CANCELLATION: { variant: 'destructive', label: 'Bekor qilinmoqda' },
      RETURNED: { variant: 'destructive', label: 'Qaytarildi' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return (
      <div className="flex flex-col gap-1">
        <Badge variant={config.variant}>{config.label}</Badge>
        {substatus && <span className="text-xs text-muted-foreground">{substatus}</span>}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), 'dd.MM.yyyy HH:mm'); }
    catch { return dateStr; }
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Buyurtmalar yo'q</h3>
          <p className="text-muted-foreground mb-4">Buyurtmalarni ko'rish uchun avval marketplace ulang</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {connectedMarketplaces.map((mp) => (
            <Button key={mp} variant={selectedMarketplace === mp ? 'default' : 'outline'} size="sm"
              onClick={() => setSelectedMarketplace(mp)}>
              {mp === 'yandex' ? '🟡 Yandex' : mp === 'uzum' ? '🟣 Uzum' : mp === 'wildberries' ? '🟣 Wildberries' : mp}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Holat" /></SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm"
            onClick={() => store.refetchOrders(selectedMarketplace)}
            disabled={store.isFetching}>
            {store.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Buyurtmalar
            {total > 0 && <Badge variant="secondary" className="ml-2">{total} ta</Badge>}
          </CardTitle>
          <CardDescription>
            {selectedMarketplace === 'yandex' ? 'Yandex Market' : selectedMarketplace} dagi buyurtmalar (so'nggi 30 kun)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <div className="flex justify-between"><Skeleton className="h-5 w-24" /><Skeleton className="h-5 w-20" /></div>
                  <Skeleton className="h-4 w-1/3" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Buyurtmalar topilmadi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Collapsible key={order.id} open={expandedOrder === order.id}
                  onOpenChange={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {(() => {
                              const firstItem = order.items?.[0];
                              const itemPhoto = (firstItem as any)?.photo;
                              const product = firstItem ? store.getProducts(selectedMarketplace).find(p => p.offerId === firstItem.offerId || p.shopSku === firstItem.offerId) : null;
                              const imgUrl = itemPhoto || product?.pictures?.[0];
                              return (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                  {imgUrl ? (
                                    <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                  ) : (
                                    <Package className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })()}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm line-clamp-1">
                                {order.items?.[0]?.offerName || `Buyurtma #${order.id}`}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>#{order.id}</span>
                                <span>•</span>
                                <span>{formatDate(order.createdAt)}</span>
                                {order.items?.[0]?.offerId && (
                                  <>
                                    <span>•</span>
                                    <code className="text-[10px]">{order.items[0].offerId}</code>
                                  </>
                                )}
                              </div>
                              {order.items && order.items.length > 1 && (
                                <span className="text-xs text-muted-foreground">+{order.items.length - 1} ta boshqa mahsulot</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            {order.buyer && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                {order.buyer.firstName} {order.buyer.lastName}
                              </div>
                            )}
                            {getStatusBadge(order.status, order.substatus)}
                            <div className="text-right">
                              <div className="font-bold">{formatPrice(order.totalUZS || order.total)}</div>
                              <div className="text-xs text-muted-foreground">{order.items?.length || 0} mahsulot</div>
                            </div>
                            <ChevronDown className={`h-5 w-5 transition-transform ${expandedOrder === order.id ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm mb-3">Mahsulotlar:</h4>
                            {order.items.map((item, idx) => {
                              const itemPhoto = (item as any)?.photo;
                              const matchedProduct = store.getProducts(selectedMarketplace).find(p => p.offerId === item.offerId || p.shopSku === item.offerId);
                              const itemImg = itemPhoto || matchedProduct?.pictures?.[0];
                              return (
                              <div key={idx} className="flex items-center justify-between p-2 bg-background rounded gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                                    {itemImg ? (
                                      <img src={itemImg} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                    ) : (
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium line-clamp-1">{item.offerName}</div>
                                    <code className="text-[10px] text-muted-foreground">{item.offerId}</code>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-medium">{formatPrice(item.priceUZS || item.price)}</div>
                                  <div className="text-xs text-muted-foreground">× {item.count}</div>
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Mahsulotlar ma'lumoti mavjud emas</p>
                        )}
                        <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Mahsulotlar:</div>
                            <div className="font-medium">{formatPrice(order.itemsTotalUZS || order.itemsTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Yetkazish:</div>
                            <div className="font-medium">{formatPrice(order.deliveryTotalUZS || order.deliveryTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Jami:</div>
                            <div className="font-bold text-primary">{formatPrice(order.totalUZS || order.total)}</div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
