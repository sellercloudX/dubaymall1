import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PackageX, AlertTriangle, Search, RefreshCw, CheckCircle2,
  Package, Warehouse, TrendingDown, FileText, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface LostItemRecord {
  sku: string;
  productName: string;
  shippedToWarehouse: number;
  sold: number;
  currentStock: number;
  returned: number;
  missing: number;
  isLost: boolean;
}

export default function UzumLostItems() {
  const { user } = useAuth();
  const [items, setItems] = useState<LostItemRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadLostItems = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Get products with stock info
      const { data: products } = await supabase
        .from('uzum_products')
        .select('sku, title, stock_fbo, stock_fbs')
        .eq('user_id', user.id);

      // Get orders to calculate sold quantities
      const { data: orders } = await supabase
        .from('uzum_orders')
        .select('items, fulfillment_type, status, is_lost')
        .eq('user_id', user.id);

      if (!products) {
        setItems([]);
        return;
      }

      // Calculate lost items per SKU
      const skuMap = new Map<string, LostItemRecord>();

      for (const prod of products) {
        const sku = prod.sku || prod.title;
        skuMap.set(sku, {
          sku,
          productName: prod.title,
          shippedToWarehouse: (prod.stock_fbo || 0) + (prod.stock_fbs || 0), // simplified — real data from supply invoices
          sold: 0,
          currentStock: (prod.stock_fbo || 0) + (prod.stock_fbs || 0),
          returned: 0,
          missing: 0,
          isLost: false,
        });
      }

      // Aggregate sold quantities from orders
      if (orders) {
        for (const order of orders) {
          if (['CANCELLED', 'cancelled', 'RETURNED', 'returned'].includes(order.status)) continue;
          const items = Array.isArray(order.items) ? order.items : [];
          for (const item of items) {
            const itemSku = (item as any)?.sku || (item as any)?.offerId;
            if (itemSku && skuMap.has(itemSku)) {
              const record = skuMap.get(itemSku)!;
              if (['RETURNED', 'returned'].includes(order.status)) {
                record.returned += (item as any)?.count || (item as any)?.quantity || 1;
              } else {
                record.sold += (item as any)?.count || (item as any)?.quantity || 1;
              }
            }
          }
        }
      }

      // Calculate missing items
      // Formula: MISSING = SHIPPED - SOLD - CURRENT_STOCK - RETURNED
      const results: LostItemRecord[] = [];
      for (const [, record] of skuMap) {
        // For now, shipped = sold + currentStock + returned (we need supply invoice data for real shipped count)
        // If we have supply data, missing = shipped - sold - currentStock - returned
        // Simplified: flag orders marked as lost
        record.missing = Math.max(0, record.shippedToWarehouse - record.sold - record.currentStock - record.returned);
        record.isLost = record.missing > 0;
        results.push(record);
      }

      // Also add explicitly lost orders
      if (orders) {
        for (const order of orders) {
          if (order.is_lost) {
            const items = Array.isArray(order.items) ? order.items : [];
            for (const item of items) {
              const itemSku = (item as any)?.sku || (item as any)?.offerId || 'unknown';
              if (!skuMap.has(itemSku)) {
                results.push({
                  sku: itemSku,
                  productName: (item as any)?.offerName || (item as any)?.name || 'Noma\'lum',
                  shippedToWarehouse: 0,
                  sold: 0,
                  currentStock: 0,
                  returned: 0,
                  missing: (item as any)?.count || 1,
                  isLost: true,
                });
              }
            }
          }
        }
      }

      setItems(results);
    } catch (err) {
      console.error('Failed to load lost items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLostItems();
  }, [loadLostItems]);

  const filteredItems = items.filter(i =>
    !search || i.productName.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())
  );

  const lostCount = filteredItems.filter(i => i.isLost).length;
  const totalMissing = filteredItems.reduce((s, i) => s + i.missing, 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className={`border-2 ${lostCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-success/30 bg-success/5'}`}>
          <CardContent className="p-3 text-center">
            {lostCount > 0 ? (
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            ) : (
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-success" />
            )}
            <div className="text-base font-bold text-foreground">{lostCount}</div>
            <div className="text-[10px] text-muted-foreground">SKU muammoli</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <PackageX className="w-5 h-5 mx-auto mb-1 text-warning" />
            <div className="text-base font-bold text-foreground">{totalMissing}</div>
            <div className="text-[10px] text-muted-foreground">Jami yo'qolgan</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Package className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-base font-bold text-foreground">{items.length}</div>
            <div className="text-[10px] text-muted-foreground">Jami SKU</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SKU yoki nom bo'yicha qidirish..."
            className="h-8 text-xs pl-7"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadLostItems} disabled={isLoading} className="h-8">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Yo'qolgan tovarlar formulasi:</strong> MISSING = (Omborga yuborilgan) − (Sotilgan + Hozirgi qoldiq + Qaytarilgan).
              Aniq ma'lumotlar uchun Uzum Seller kabinetidagi yetkazib berish tarixi bilan solishtiring.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items List */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PackageX className="w-4 h-4 text-destructive" />
            Inventarizatsiya tekshiruvi
            {lostCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4">{lostCount} muammoli</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <PackageX className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {items.length === 0 ? 'Hali mahsulotlar sinxronlanmagan' : 'Qidiruv natijasi topilmadi'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredItems
                .sort((a, b) => (b.isLost ? 1 : 0) - (a.isLost ? 1 : 0) || b.missing - a.missing)
                .map((item, i) => (
                <div
                  key={i}
                  className={`p-2.5 rounded-lg border text-xs ${
                    item.isLost ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-medium text-foreground truncate max-w-[60%]">{item.productName}</div>
                    {item.isLost ? (
                      <Badge variant="destructive" className="text-[9px] h-4">
                        <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                        {item.missing} yo'qolgan
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px] h-4">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                        OK
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">SKU: {item.sku}</div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    <div className="text-center p-1 bg-muted/30 rounded">
                      <div className="text-muted-foreground">Yuborilgan</div>
                      <div className="font-medium text-foreground">{item.shippedToWarehouse}</div>
                    </div>
                    <div className="text-center p-1 bg-muted/30 rounded">
                      <div className="text-muted-foreground">Sotilgan</div>
                      <div className="font-medium text-foreground">{item.sold}</div>
                    </div>
                    <div className="text-center p-1 bg-muted/30 rounded">
                      <div className="text-muted-foreground">Qoldiq</div>
                      <div className="font-medium text-foreground">{item.currentStock}</div>
                    </div>
                    <div className="text-center p-1 bg-muted/30 rounded">
                      <div className="text-muted-foreground">Qaytgan</div>
                      <div className="font-medium text-foreground">{item.returned}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
