import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Truck, Package, Search, RefreshCw, Loader2, FileText,
  CheckCircle2, Clock, AlertTriangle, MapPin, Calendar,
  Printer, Download, ArrowRight, PackageCheck, Timer,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface FBSOrder {
  id: string;
  order_code: string;
  order_number: string | null;
  status: string | null;
  fulfillment_type: string | null;
  total_amount: number | null;
  items: any;
  buyer_info: any;
  delivery_info: any;
  created_at: string | null;
  substatus: string | null;
  label_url: string | null;
  label_generated_at: string | null;
}

const FBS_STATUSES: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  CREATED: { label: 'Yangi', color: 'text-primary', icon: Clock },
  PACKING: { label: 'Yig\'ilmoqda', color: 'text-warning', icon: Package },
  READY_TO_SHIP: { label: 'Jo\'natishga tayyor', color: 'text-accent', icon: PackageCheck },
  SHIPPED: { label: 'Jo\'natilgan', color: 'text-success', icon: Truck },
  DELIVERING: { label: 'Yetkazilmoqda', color: 'text-primary', icon: MapPin },
  DELIVERED: { label: 'Yetkazildi', color: 'text-success', icon: CheckCircle2 },
  CANCELLED: { label: 'Bekor qilingan', color: 'text-destructive', icon: AlertTriangle },
};

const fmt = (n: number) => n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function UzumFBSLogistics() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<FBSOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('pending');
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from('uzum_orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('fulfillment_type', 'FBS')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      setOrders((data || []) as unknown as FBSOrder[]);
    } catch (err) {
      console.error('Failed to load FBS orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !search ||
      o.order_code?.toLowerCase().includes(search.toLowerCase()) ||
      (o.buyer_info as any)?.name?.toLowerCase().includes(search.toLowerCase());

    if (filter === 'pending') {
      return matchesSearch && ['CREATED', 'PACKING', 'READY_TO_SHIP'].includes(o.status || '');
    }
    if (filter === 'shipped') {
      return matchesSearch && ['SHIPPED', 'DELIVERING'].includes(o.status || '');
    }
    if (filter === 'completed') {
      return matchesSearch && ['DELIVERED'].includes(o.status || '');
    }
    return matchesSearch;
  });

  const pendingCount = orders.filter(o => ['CREATED', 'PACKING', 'READY_TO_SHIP'].includes(o.status || '')).length;
  const shippedCount = orders.filter(o => ['SHIPPED', 'DELIVERING'].includes(o.status || '')).length;
  const todayOrders = orders.filter(o => {
    const created = new Date(o.created_at || '');
    const today = new Date();
    return created.toDateString() === today.toDateString();
  }).length;

  const generateLabel = async (order: FBSOrder) => {
    setGeneratingLabel(order.id);
    try {
      // Get uzum account
      const { data: account } = await supabase
        .from('uzum_accounts')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1)
        .single();

      if (!account) {
        toast({ title: 'Xato', description: 'Uzum akkaunt topilmadi', variant: 'destructive' });
        return;
      }

      // Send label generation command to extension
      const { error } = await supabase.from('uzum_extension_commands').insert({
        user_id: user!.id,
        uzum_account_id: account.id,
        command_type: 'generate_label',
        payload: {
          orderId: order.order_code,
          orderStatus: order.status,
          items: order.items,
          buyerInfo: order.buyer_info,
          deliveryInfo: order.delivery_info,
        },
        status: 'pending',
      } as any);

      if (error) throw error;
      toast({
        title: 'Etiketka so\'rovi yuborildi',
        description: 'Chrome Extension orqali PDF etiketka generatsiya qilinadi',
      });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingLabel(null);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('uzum_orders')
        .update({ status: newStatus, fbs_substatus: newStatus } as any)
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      toast({ title: 'Status yangilandi' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    }
  };

  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return `${Math.floor(diff / 60000)} min oldin`;
    if (hours < 24) return `${hours} soat oldin`;
    return `${Math.floor(hours / 24)} kun oldin`;
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className={`border-2 ${pendingCount > 0 ? 'border-warning/30 bg-warning/5' : 'border-border'}`}>
          <CardContent className="p-3 text-center">
            <Timer className="w-5 h-5 mx-auto mb-1 text-warning" />
            <div className="text-base font-bold text-foreground">{pendingCount}</div>
            <div className="text-[10px] text-muted-foreground">Kutilmoqda</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Truck className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-base font-bold text-foreground">{shippedCount}</div>
            <div className="text-[10px] text-muted-foreground">Yo'lda</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-accent" />
            <div className="text-base font-bold text-foreground">{todayOrders}</div>
            <div className="text-[10px] text-muted-foreground">Bugungi</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buyurtma ID yoki mijoz..." className="h-8 text-xs pl-7" />
        </div>
        <Button variant="outline" size="sm" onClick={loadOrders} disabled={isLoading} className="h-8">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5">
        {[
          { id: 'pending', label: 'Kutilmoqda', count: pendingCount },
          { id: 'shipped', label: 'Yo\'lda', count: shippedCount },
          { id: 'completed', label: 'Yetkazildi', count: 0 },
          { id: 'all', label: 'Hammasi', count: orders.length },
        ].map(f => (
          <Button
            key={f.id}
            variant={filter === f.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.id)}
            className="h-7 text-[10px] px-2"
          >
            {f.label}
            {f.count > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] h-3.5 px-1">{f.count}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Batch Actions */}
      {pendingCount > 0 && filter === 'pending' && (
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              <strong>{pendingCount}</strong> ta buyurtma yig'ish va jo'natish kutilmoqda
            </div>
            <Button size="sm" className="h-7 text-[10px]" onClick={() => {
              filteredOrders.forEach(o => {
                if (['CREATED', 'PACKING'].includes(o.status)) {
                  generateLabel(o);
                }
              });
            }}>
              <Printer className="w-3 h-3 mr-1" />
              Barcha etiketkalar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-accent" />
            FBS buyurtmalar
            {filteredOrders.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4">{filteredOrders.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">
                {orders.length === 0 ? 'FBS buyurtmalar yo\'q' : 'Filtrga mos buyurtma topilmadi'}
              </p>
              <p className="text-[10px] mt-1">
                {orders.length === 0 ? 'Uzum Market\'dan FBS buyurtmalar sinxronlanganda bu yerda ko\'rinadi' : 'Boshqa filtrni tanlang'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredOrders.map(order => {
                const statusInfo = FBS_STATUSES[order.status] || FBS_STATUSES.CREATED;
                const StatusIcon = statusInfo.icon;
                const items = Array.isArray(order.items) ? order.items : [];
                const itemCount = items.reduce((s: number, i: any) => s + ((i as any)?.count || (i as any)?.quantity || 1), 0);

                return (
                  <div
                    key={order.id}
                    className={`p-3 rounded-lg border text-xs transition-all ${
                      ['CREATED', 'PACKING'].includes(order.status)
                        ? 'border-warning/30 bg-warning/5'
                        : order.status === 'READY_TO_SHIP'
                        ? 'border-accent/30 bg-accent/5'
                        : 'border-border/50 bg-card'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        <div>
                          <span className="font-medium text-foreground">#{order.order_code}</span>
                          <Badge variant="outline" className={`ml-1.5 text-[9px] h-4 ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{getTimeAgo(order.created_at)}</span>
                    </div>

                    {/* Items */}
                    <div className="mb-2">
                      {items.slice(0, 2).map((item: any, i: number) => (
                        <div key={i} className="text-[10px] text-muted-foreground truncate">
                          • {item.offerName || item.name || item.title || 'Nomsiz'} × {item.count || item.quantity || 1}
                        </div>
                      ))}
                      {items.length > 2 && (
                        <div className="text-[10px] text-muted-foreground">... va yana {items.length - 2} ta</div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{itemCount} dona</span>
                        <span className="font-medium text-foreground">{fmt(order.total_amount || 0)} so'm</span>
                      </div>
                      <div className="flex gap-1.5">
                        {['CREATED', 'PACKING'].includes(order.status) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => generateLabel(order)}
                              disabled={generatingLabel === order.id}
                            >
                              {generatingLabel === order.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Printer className="w-3 h-3 mr-0.5" />
                              )}
                              Etiketka
                            </Button>
                            <Button
                              size="sm"
                              className="h-6 text-[10px] px-2"
                              onClick={() => updateOrderStatus(order.id, 'READY_TO_SHIP')}
                            >
                              <PackageCheck className="w-3 h-3 mr-0.5" />
                              Tayyor
                            </Button>
                          </>
                        )}
                        {order.status === 'READY_TO_SHIP' && (
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => updateOrderStatus(order.id, 'SHIPPED')}
                          >
                            <Truck className="w-3 h-3 mr-0.5" />
                            Jo'natildi
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
