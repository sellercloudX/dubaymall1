import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ShoppingCart, Filter, RefreshCw, Loader2, AlertCircle, ChevronDown, User, Package } from 'lucide-react';
import { format } from 'date-fns';

interface OrderItem {
  offerId: string;
  offerName: string;
  count: number;
  price: number;
}

interface MarketplaceOrder {
  id: number;
  status: string;
  substatus?: string;
  createdAt: string;
  total: number;
  itemsTotal: number;
  deliveryTotal: number;
  buyer?: {
    firstName?: string;
    lastName?: string;
  };
  items?: OrderItem[];
}

interface MarketplaceOrdersProps {
  connectedMarketplaces: string[];
  fetchMarketplaceData: (marketplace: string, dataType: string, options?: Record<string, any>) => Promise<any>;
}

const ORDER_STATUSES = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'PROCESSING', label: 'Jarayonda' },
  { value: 'DELIVERY', label: 'Yetkazilmoqda' },
  { value: 'PICKUP', label: 'Olib ketish' },
  { value: 'DELIVERED', label: 'Yetkazildi' },
  { value: 'CANCELLED', label: 'Bekor qilindi' },
];

export function MarketplaceOrders({ connectedMarketplaces, fetchMarketplaceData }: MarketplaceOrdersProps) {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (connectedMarketplaces.length > 0 && !selectedMarketplace) {
      setSelectedMarketplace(connectedMarketplaces[0]);
    }
  }, [connectedMarketplaces, selectedMarketplace]);

  useEffect(() => {
    if (selectedMarketplace) {
      loadOrders();
    }
  }, [selectedMarketplace, statusFilter]);

  const loadOrders = async () => {
    if (!selectedMarketplace) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const options: Record<string, any> = {};
      if (statusFilter && statusFilter !== 'all') {
        options.status = statusFilter;
      }
      
      const result = await fetchMarketplaceData(selectedMarketplace, 'orders', options);
      
      if (result.success) {
        setOrders(result.data || []);
        setTotal(result.total || 0);
      } else {
        setError(result.error || 'Buyurtmalarni yuklashda xatolik');
        setOrders([]);
      }
    } catch (err: any) {
      setError(err.message || 'Noma\'lum xatolik');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return new Intl.NumberFormat('uz-UZ', { 
      style: 'decimal',
      minimumFractionDigits: 0 
    }).format(price) + ' so\'m';
  };

  const getStatusBadge = (status: string, substatus?: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PROCESSING: { variant: 'secondary', label: 'Jarayonda' },
      DELIVERY: { variant: 'default', label: 'Yetkazilmoqda' },
      PICKUP: { variant: 'outline', label: 'Olib ketish' },
      DELIVERED: { variant: 'default', label: 'Yetkazildi' },
      CANCELLED: { variant: 'destructive', label: 'Bekor qilindi' },
      UNPAID: { variant: 'outline', label: 'To\'lanmagan' },
    };
    
    const config = variants[status] || { variant: 'outline' as const, label: status };
    
    return (
      <div className="flex flex-col gap-1">
        <Badge variant={config.variant}>{config.label}</Badge>
        {substatus && (
          <span className="text-xs text-muted-foreground">{substatus}</span>
        )}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Buyurtmalar yo'q</h3>
          <p className="text-muted-foreground mb-4">
            Buyurtmalarni ko'rish uchun avval marketplace ulang
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Marketplace tabs */}
          {connectedMarketplaces.map((mp) => (
            <Button
              key={mp}
              variant={selectedMarketplace === mp ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarketplace(mp)}
            >
              {mp === 'yandex' ? '🟡 Yandex' : mp === 'uzum' ? '🟣 Uzum' : mp}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadOrders}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={loadOrders} className="ml-auto">
                Qayta urinish
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Buyurtmalar
            {total > 0 && (
              <Badge variant="secondary" className="ml-2">{total} ta</Badge>
            )}
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
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Buyurtmalar topilmadi</p>
              {statusFilter && statusFilter !== 'all' && (
                <p className="text-sm mt-1">Tanlangan holat bo'yicha natija yo'q</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Collapsible
                  key={order.id}
                  open={expandedOrder === order.id}
                  onOpenChange={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger asChild>
                      <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="font-semibold">#{order.id}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatDate(order.createdAt)}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {order.buyer && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                {order.buyer.firstName} {order.buyer.lastName}
                              </div>
                            )}
                            
                            {getStatusBadge(order.status, order.substatus)}
                            
                            <div className="text-right">
                              <div className="font-bold">{formatPrice(order.total)}</div>
                              <div className="text-xs text-muted-foreground">
                                {order.items?.length || 0} mahsulot
                              </div>
                            </div>
                            
                            <ChevronDown className={`h-5 w-5 transition-transform ${
                              expandedOrder === order.id ? 'rotate-180' : ''
                            }`} />
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        {order.items && order.items.length > 0 ? (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm mb-3">Mahsulotlar:</h4>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-background rounded">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium">{item.offerName}</div>
                                    <div className="text-xs text-muted-foreground">
                                      ID: {item.offerId}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium">{formatPrice(item.price)}</div>
                                  <div className="text-xs text-muted-foreground">
                                    × {item.count}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Mahsulotlar ma'lumoti mavjud emas</p>
                        )}
                        
                        <div className="mt-4 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Mahsulotlar:</div>
                            <div className="font-medium">{formatPrice(order.itemsTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Yetkazish:</div>
                            <div className="font-medium">{formatPrice(order.deliveryTotal)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Jami:</div>
                            <div className="font-bold text-primary">{formatPrice(order.total)}</div>
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
