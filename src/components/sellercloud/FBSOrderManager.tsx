import { useState, useMemo, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Package, CheckCircle, XCircle, Printer, Truck, RefreshCw, Loader2,
  ClipboardList, MapPin, AlertTriangle, Archive, Send, Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { MarketplaceDataStore, MarketplaceOrder } from '@/hooks/useMarketplaceDataStore';
import { MARKETPLACE_CONFIG, MarketplaceLogo } from '@/lib/marketplaceConfig';
import { toDisplayUzs, formatUzs } from '@/lib/currency';
import { useOrderManagement } from '@/hooks/useOrderManagement';

interface FBSOrderManagerProps {
  connectedMarketplaces: string[];
  store: MarketplaceDataStore;
}

// Unified FBS status tabs mapping marketplace-specific statuses
const FBS_TABS = [
  { key: 'new', label: 'Yangilar', icon: Package,
    statuses: ['CREATED', 'NEW', 'new', 'STARTED'] },
  { key: 'assembly', label: "Yig'ishdagi", icon: ClipboardList,
    statuses: ['PROCESSING', 'PACKING', 'CONFIRM', 'confirm', 'SORTED', 'sorted', 'READY_TO_SHIP', 'SHIP'] },
  { key: 'shipping', label: 'Yetkazishda', icon: Truck,
    statuses: ['PENDING_DELIVERY', 'DELIVERY', 'DELIVERING', 'COMPLETE', 'complete', 'SHIPPED', 'PICKUP'] },
  { key: 'delivered', label: 'Topshirilgan', icon: CheckCircle,
    statuses: ['DELIVERED', 'COMPLETED', 'RECEIVE', 'receive', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT'] },
  { key: 'cancelled', label: 'Bekor', icon: XCircle,
    statuses: ['CANCELLED', 'CANCELED', 'RETURNED', 'CANCEL', 'cancel', 'REJECTED', 'REJECT', 'reject'] },
];

const normalizeOfferKey = (v?: string) => String(v || '').trim().toLowerCase();

// Cancel reasons per marketplace
const CANCEL_REASONS: Record<string, { value: string; label: string }[]> = {
  uzum: [
    { value: 'SELLER_CANCEL', label: 'Sotuvchi bekor qildi' },
    { value: 'OUT_OF_STOCK', label: 'Tovar tugadi' },
    { value: 'WRONG_PRICE', label: 'Narx xato' },
  ],
  wildberries: [
    { value: 'cancel', label: 'Bekor qilish' },
  ],
  yandex: [
    { value: 'SHOP_FAILED', label: 'Do\'kon tomonidan' },
    { value: 'REPLACING_ORDER', label: 'Buyurtma almashtirildi' },
    { value: 'PROCESSING_EXPIRED', label: 'Muddati o\'tdi' },
  ],
};

export function FBSOrderManager({ connectedMarketplaces, store }: FBSOrderManagerProps) {
  const [selectedMp, setSelectedMp] = useState(connectedMarketplaces[0] || '');
  const [activeTab, setActiveTab] = useState('new');
  const [selectedOrders, setSelectedOrders] = useState<Set<string | number>>(new Set());
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('SELLER_CANCEL');
  const [dropOffDialogOpen, setDropOffDialogOpen] = useState(false);
  const [dropOffPoints, setDropOffPoints] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  // WB supply dialog
  const [wbSupplyDialogOpen, setWbSupplyDialogOpen] = useState(false);
  const [wbSupplyName, setWbSupplyName] = useState('');
  const queryClient = useQueryClient();

  // Track optimistic status overrides that survive cache refetches
  // Map<orderId, { newStatus, timestamp, originalOrder }>
  const optimisticOverridesRef = useRef<Map<string, { newStatus: string; timestamp: number; order: MarketplaceOrder }>>(new Map());

  const {
    isLoading, actionInProgress, confirmOrders, cancelOrders, getLabels,
    getDropOffPoints, getTimeSlots, createInvoice, setDropOff,
    getSupplies, addToSupply, executeAction,
  } = useOrderManagement();

  // Optimistically update order statuses — stores overrides in a ref that persists across refetches
  const optimisticStatusUpdate = useCallback((
    marketplace: string,
    orderIds: (string | number)[],
    newStatus: string
  ) => {
    const allMpOrders = store.getOrders(marketplace);
    const idSet = new Set(orderIds.map(id => String(id)));
    
    // Save original orders with new status to ref
    for (const order of allMpOrders) {
      if (idSet.has(String(order.id))) {
        optimisticOverridesRef.current.set(String(order.id), {
          newStatus,
          timestamp: Date.now(),
          order: { ...order, status: newStatus },
        });
      }
    }

    // Also update query cache for immediate effect
    queryClient.setQueriesData(
      { queryKey: ['marketplace-orders', marketplace] },
      (oldData: any) => {
        if (!oldData?.data) return oldData;
        return {
          ...oldData,
          data: oldData.data.map((order: any) =>
            idSet.has(String(order.id))
              ? { ...order, status: newStatus }
              : order
          ),
        };
      }
    );
  }, [queryClient, store]);

  const allOrders = store.getOrders(selectedMp);

  // Merge API orders with optimistic overrides
  // Overrides persist for 2 minutes to survive API propagation delays
  const mergedOrders = useMemo(() => {
    const overrides = optimisticOverridesRef.current;
    const now = Date.now();
    const OVERRIDE_TTL = 2 * 60 * 1000; // 2 minutes
    
    // Clean expired overrides
    for (const [id, entry] of overrides) {
      if (now - entry.timestamp > OVERRIDE_TTL) overrides.delete(id);
    }
    
    // Build merged list: apply overrides to existing orders, add missing ones
    const orderMap = new Map<string, MarketplaceOrder>();
    for (const order of allOrders) {
      const id = String(order.id);
      const override = overrides.get(id);
      if (override) {
        // API returned the order — check if API status matches override
        const apiStatusUpper = order.status?.toUpperCase();
        const overrideStatusUpper = override.newStatus.toUpperCase();
        // If API already shows a "later" status, remove override
        const statusOrder = ['NEW', 'PACKING', 'SHIPPED', 'DELIVERY', 'DELIVERED', 'CANCELLED'];
        const apiIdx = statusOrder.indexOf(apiStatusUpper);
        const overrideIdx = statusOrder.indexOf(overrideStatusUpper);
        if (apiIdx >= overrideIdx && apiIdx >= 0) {
          // API caught up or passed — use API status
          overrides.delete(id);
          orderMap.set(id, order);
        } else {
          // API is behind — use override
          orderMap.set(id, { ...order, status: override.newStatus });
        }
      } else {
        orderMap.set(id, order);
      }
    }
    
    // Add any optimistic orders not in API response (disappeared during propagation)
    for (const [id, entry] of overrides) {
      if (!orderMap.has(id)) {
        orderMap.set(id, entry.order);
      }
    }
    
    return Array.from(orderMap.values());
  }, [allOrders]);

  const ordersByTab = useMemo(() => {
    const map: Record<string, MarketplaceOrder[]> = {};
    for (const tab of FBS_TABS) {
      map[tab.key] = mergedOrders.filter(o =>
        tab.statuses.some(s => o.status?.toUpperCase() === s.toUpperCase())
      );
    }
    return map;
  }, [mergedOrders]);

  const currentOrders = ordersByTab[activeTab] || [];

  const toggleSelect = (id: string | number) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedOrders.size === currentOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(currentOrders.map(o => o.id)));
    }
  };

  const getSelectedIds = () => Array.from(selectedOrders);

  // ===== CONFIRM =====
  const handleConfirm = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return toast.warning("Buyurtma tanlang");

    if (selectedMp === 'wildberries') {
      // WB: show supply dialog — confirm = create supply + add orders
      setWbSupplyDialogOpen(true);
      return;
    }

    try {
      await confirmOrders(selectedMp, ids);
      // Optimistically move orders to assembly tab
      const targetStatus = selectedMp === 'yandex' ? 'PROCESSING' : 'PACKING';
      optimisticStatusUpdate(selectedMp, ids, targetStatus);
      setSelectedOrders(new Set());
      // Delayed refetch to let marketplace API update
      setTimeout(() => store.refetchOrders(selectedMp), 30000);
    } catch {}
  };

  // WB confirm via supply creation
  const handleWbConfirmWithSupply = async () => {
    const ids = getSelectedIds();
    try {
      const result = await executeAction({
        marketplace: 'wildberries',
        action: 'confirm',
        orderIds: ids,
        supplyName: wbSupplyName || undefined,
      });
      const successCount = result.results?.filter((r: any) => r.success).length || 0;
      const successIds = result.results
        ?.filter((r: any) => r.success)
        ?.map((r: any) => r.orderId || r.id) || ids;
      if (result.supplyId) {
        toast.success(`Postavka ${result.supplyId} yaratildi. ${successCount}/${ids.length} buyurtma qo'shildi`);
      } else {
        toast.success(`${successCount}/${ids.length} buyurtma tasdiqlandi`);
      }
      // Optimistically move confirmed orders to assembly tab
      optimisticStatusUpdate('wildberries', successIds, 'PACKING');
      setWbSupplyDialogOpen(false);
      setWbSupplyName('');
      setSelectedOrders(new Set());
      // Delayed refetch to let WB API update statuses
      setTimeout(() => store.refetchOrders(selectedMp), 30000);
    } catch {}
  };

  // ===== CANCEL =====
  const handleCancel = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    try {
      await cancelOrders(selectedMp, ids, cancelReason);
      optimisticStatusUpdate(selectedMp, ids, 'CANCELLED');
      setCancelDialogOpen(false);
      setSelectedOrders(new Set());
      setTimeout(() => store.refetchOrders(selectedMp), 30000);
    } catch {}
  };

  // ===== LABELS =====
  const openStickersPrintWindow = (stickers: { file: string; orderId?: string | number }[]) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error("Popup bloklangan. Brauzerni sozlang.");
      return;
    }
    const stickerImgs = stickers
      .filter(s => s.file)
      .map(s => `<div style="page-break-inside:avoid;margin:8px auto;text-align:center;">
        <img src="data:image/png;base64,${s.file}" style="width:58mm;height:40mm;object-fit:contain;" />
        <div style="font-size:10px;color:#666;margin-top:2px;">ID: ${s.orderId || '—'}</div>
      </div>`)
      .join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Stikerlar</title>
      <style>
        @media print { body{margin:0;padding:0;} div{page-break-inside:avoid;} }
        body{font-family:sans-serif;padding:16px;}
        .actions{display:flex;gap:8px;margin-bottom:16px;justify-content:center;}
        .actions button{padding:8px 20px;font-size:14px;border-radius:6px;cursor:pointer;border:1px solid #ccc;background:#fff;}
        .actions button.primary{background:#2563eb;color:#fff;border-color:#2563eb;}
        @media print{.actions{display:none !important;}}
      </style></head><body>
      <div class="actions">
        <button class="primary" onclick="window.print()">🖨️ Pechat qilish</button>
      </div>
      ${stickerImgs}
    </body></html>`);
    printWindow.document.close();
  };

  // Open PDF labels in a print window (for Yandex/Uzum multi-label)
  const openPdfLabelsPrintWindow = (labels: { pdf: string; orderId: string | number }[]) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      toast.error("Popup bloklangan. Brauzerni sozlang.");
      return;
    }
    const embedFrames = labels.map((l, i) => `
      <div style="page-break-after:always;margin-bottom:16px;">
        <div style="font-size:12px;color:#666;margin-bottom:4px;">Buyurtma #${l.orderId} (${i + 1}/${labels.length})</div>
        <iframe src="data:application/pdf;base64,${l.pdf}" style="width:100%;height:calc(100vh - 120px);border:1px solid #ddd;border-radius:4px;"></iframe>
      </div>`).join('');
    
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Etiketkalar (${labels.length} ta)</title>
      <style>
        body{font-family:sans-serif;padding:16px;margin:0;}
        .actions{display:flex;gap:8px;margin-bottom:16px;justify-content:center;flex-wrap:wrap;}
        .actions button{padding:8px 20px;font-size:14px;border-radius:6px;cursor:pointer;border:1px solid #ccc;background:#fff;}
        .actions button.primary{background:#2563eb;color:#fff;border-color:#2563eb;}
        .actions button.download{background:#059669;color:#fff;border-color:#059669;}
        @media print{.actions{display:none !important;} iframe{height:auto !important;}}
      </style></head><body>
      <div class="actions">
        <button class="primary" onclick="window.print()">🖨️ Barchasini pechat qilish</button>
        <button class="download" onclick="downloadAll()">📥 Barchasini yuklab olish</button>
      </div>
      ${embedFrames}
      <script>
        const labels = ${JSON.stringify(labels.map(l => ({ pdf: l.pdf, orderId: l.orderId })))};
        function downloadAll() {
          labels.forEach(l => {
            const a = document.createElement('a');
            a.href = 'data:application/pdf;base64,' + l.pdf;
            a.download = 'label_' + l.orderId + '.pdf';
            a.click();
          });
        }
      </script>
    </body></html>`);
    printWindow.document.close();
  };

  const handlePrintLabels = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return toast.warning("Buyurtma tanlang");

    if (selectedMp === 'wildberries' && activeTab === 'new') {
      return toast.warning("WB stikerlarini olish uchun avval buyurtmalarni tasdiqlang (postavkaga qo'shing)");
    }

    try {
      const result = await getLabels(selectedMp, ids);
      
      if (selectedMp === 'wildberries' && result?.stickers) {
        if (result.stickers.length === 0) {
          toast.warning("Stikerlar topilmadi. Buyurtmalar yig'ish holatida ekanligini tekshiring.");
          return;
        }
        // Open print window with all stickers
        openStickersPrintWindow(result.stickers);
        toast.success(`${result.stickers.length} ta stiker tayyor — pechat qiling yoki PDF saqlang`);
      } else if (result?.labels) {
        // Multiple PDFs as base64
        result.labels.forEach((l: any) => {
          if (l.pdf && l.success) {
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${l.pdf}`;
            link.download = `label_${l.orderId}.pdf`;
            link.click();
          }
        });
        const successCount = result.labels.filter((l: any) => l.success).length;
        toast.success(`${successCount} ta etiketka yuklandi`);
      } else {
        toast.success("Etiketka tayyor");
      }
    } catch {}
  };

  // ===== DROP-OFF (Uzum only) =====
  const handleDropOff = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return toast.warning("Buyurtma tanlang");
    try {
      const result = await getDropOffPoints(ids);
      setDropOffPoints(result.data || []);
      setDropOffDialogOpen(true);
    } catch {}
  };

  const handleSelectPoint = async (pointId: string) => {
    setSelectedPoint(pointId);
    try {
      const result = await getTimeSlots(getSelectedIds(), pointId);
      setTimeSlots(result.data || []);
    } catch {}
  };

  const handleSubmitDropOff = async () => {
    if (!selectedPoint || !selectedSlot) return toast.warning("Punkt va vaqtni tanlang");
    try {
      const invoiceResult = await createInvoice(getSelectedIds());
      const invId = invoiceResult.data?.invoiceId || invoiceResult.data?.id;
      if (invId) {
        await setDropOff(String(invId), selectedPoint, selectedSlot);
        toast.success("Topshirish punkti belgilandi!");
      }
      setDropOffDialogOpen(false);
      setSelectedOrders(new Set());
      store.refetchOrders(selectedMp);
    } catch {}
  };

  // ===== WB DELIVER SUPPLY =====
  const handleDeliverSupply = async (supplyId: string) => {
    try {
      await executeAction({ marketplace: 'wildberries', action: 'deliver-supply', supplyId });
      toast.success("Postavka yetkazishga topshirildi");
      store.refetchOrders(selectedMp);
    } catch {}
  };

  const formatPrice = (price?: number) => {
    if (!price && price !== 0) return '—';
    return formatUzs(toDisplayUzs(price, selectedMp)) + " so'm";
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'dd.MM.yyyy HH:mm'); }
    catch { return d; }
  };

  const getStatusColor = (status: string) => {
    const s = status?.toUpperCase();
    if (['CANCELLED', 'CANCELED', 'RETURNED', 'CANCEL', 'REJECTED'].includes(s)) return 'destructive';
    if (['DELIVERED', 'COMPLETED'].includes(s)) return 'default';
    if (['PACKING', 'PROCESSING', 'READY_TO_SHIP', 'CONFIRM'].includes(s)) return 'secondary';
    if (['COMPLETE', 'DELIVERY', 'SHIPPED', 'DELIVERING'].includes(s)) return 'outline';
    return 'outline';
  };

  // Marketplace-specific action hints
  const getConfirmLabel = () => {
    if (selectedMp === 'wildberries') return 'Postavkaga qo\'shish';
    if (selectedMp === 'yandex') return 'Qabul qilish';
    return 'Tasdiqlash';
  };

  if (connectedMarketplaces.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">Marketplace ulang</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Marketplace selector */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          {connectedMarketplaces.map(mp => (
            <Button key={mp} variant={selectedMp === mp ? 'default' : 'outline'} size="sm"
              onClick={() => { setSelectedMp(mp); setSelectedOrders(new Set()); }}>
              <MarketplaceLogo marketplace={mp} size={16} className="mr-1" />
              {MARKETPLACE_CONFIG[mp]?.name || mp}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => store.refetchOrders(selectedMp)} disabled={store.isFetching}>
          {store.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Yangilash</span>
        </Button>
      </div>

      {/* Marketplace-specific info banner */}
      {selectedMp === 'wildberries' && activeTab === 'new' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm">
          <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
          <div className="text-blue-800 dark:text-blue-200">
            <strong>WB FBS:</strong> Buyurtmalarni tasdiqlash uchun ularni <strong>postavka</strong>ga qo'shing. 
            Stikerlar faqat yig'ishdagi buyurtmalar uchun mavjud.
          </div>
        </div>
      )}

      {/* FBS Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedOrders(new Set()); }}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {FBS_TABS.map(tab => {
            const count = ordersByTab[tab.key]?.length || 0;
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5">
                <Icon className="h-4 w-4" />
                {tab.label}
                {count > 0 && <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">{count}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {FBS_TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {tab.label}
                    <Badge variant="outline">{currentOrders.length} ta</Badge>
                  </CardTitle>

                  {/* Action buttons */}
                  {selectedOrders.size > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {activeTab === 'new' && (
                        <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
                          {actionInProgress === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : 
                           selectedMp === 'wildberries' ? <Archive className="h-4 w-4 mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                          {getConfirmLabel()} ({selectedOrders.size})
                        </Button>
                      )}

                      {/* Labels - for assembly tab always, for new tab only non-WB */}
                      {(activeTab === 'assembly' || (activeTab === 'new' && selectedMp !== 'wildberries')) && (
                        <Button size="sm" variant="outline" onClick={handlePrintLabels} disabled={isLoading}>
                          {actionInProgress === 'labels' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Printer className="h-4 w-4 mr-1" />}
                          {selectedMp === 'wildberries' ? 'Stiker' : 'Etiketka'}
                        </Button>
                      )}

                      {/* Uzum drop-off */}
                      {activeTab === 'assembly' && selectedMp === 'uzum' && (
                        <Button size="sm" variant="outline" onClick={handleDropOff} disabled={isLoading}>
                          <MapPin className="h-4 w-4 mr-1" />
                          Topshirish punkti
                        </Button>
                      )}

                      {/* Cancel */}
                      {(activeTab === 'new' || activeTab === 'assembly') && (
                        <Button size="sm" variant="destructive" onClick={() => {
                          setCancelReason(CANCEL_REASONS[selectedMp]?.[0]?.value || 'SELLER_CANCEL');
                          setCancelDialogOpen(true);
                        }} disabled={isLoading}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Bekor ({selectedOrders.size})
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {store.isLoadingOrders ? (
                  <div className="py-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>
                ) : currentOrders.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Bu statusda buyurtmalar yo'q</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                      <Checkbox checked={selectedOrders.size === currentOrders.length && currentOrders.length > 0}
                        onCheckedChange={toggleAll} />
                      <span className="w-24">№ Buyurtma</span>
                      <span className="flex-1">Mahsulot</span>
                      <span className="w-36">Yaratilgan</span>
                      <span className="w-24 text-right">Narxi</span>
                      <span className="w-24 text-center">Holat</span>
                    </div>

                    {/* Order rows */}
                    {currentOrders.map(order => {
                      const firstItem = order.items?.[0];
                      const product = firstItem ? store.getProducts(selectedMp).find(p =>
                        normalizeOfferKey(p.offerId) === normalizeOfferKey(firstItem.offerId)
                      ) : null;
                      const imgUrl = (firstItem as any)?.photo || product?.pictures?.[0];

                      return (
                        <div key={order.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors ${selectedOrders.has(order.id) ? 'bg-primary/5' : ''}`}
                        >
                          <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                          <span className="w-24 font-mono text-sm truncate">{order.id}</span>
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {imgUrl ? <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => e.currentTarget.style.display = 'none'} />
                                : <Package className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {product?.name || firstItem?.offerName || firstItem?.offerId || '—'}
                              </div>
                              {order.items && order.items.length > 1 && (
                                <span className="text-xs text-muted-foreground">+{order.items.length - 1} ta mahsulot</span>
                              )}
                            </div>
                          </div>
                          <span className="w-36 text-xs text-muted-foreground">{formatDate(order.createdAt)}</span>
                          <span className="w-24 text-right font-medium text-sm">{formatPrice(order.total)}</span>
                          <div className="w-24 text-center">
                            <Badge variant={getStatusColor(order.status) as any} className="text-[10px]">
                              {order.status}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}

                    {/* Summary */}
                    <div className="flex items-center justify-between px-3 py-2 border-t mt-2 text-sm">
                      <span className="text-muted-foreground">{currentOrders.length} buyurtma</span>
                      <span className="font-bold">
                        {formatUzs(currentOrders.reduce((s, o) => s + toDisplayUzs(o.total || 0, selectedMp), 0))} so'm
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* ===== Cancel Dialog ===== */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Buyurtmalarni bekor qilish
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.size} ta buyurtma bekor qilinadi. Bu amalni qaytarib bo'lmaydi.
            </DialogDescription>
          </DialogHeader>
          <Select value={cancelReason} onValueChange={setCancelReason}>
            <SelectTrigger><SelectValue placeholder="Sabab" /></SelectTrigger>
            <SelectContent>
              {(CANCEL_REASONS[selectedMp] || CANCEL_REASONS.uzum).map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Yopish</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Bekor qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== WB Supply Confirm Dialog ===== */}
      <Dialog open={wbSupplyDialogOpen} onOpenChange={setWbSupplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              Postavka yaratish va buyurtmalarni qo'shish
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.size} ta buyurtma yangi postavkaga qo'shiladi va "Yig'ishda" holatiga o'tadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Postavka nomi (ixtiyoriy)</label>
              <Input
                placeholder={`SC-${new Date().toISOString().slice(0, 10)}`}
                value={wbSupplyName}
                onChange={e => setWbSupplyName(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              ℹ️ Postavka yaratilgandan so'ng, stikerlarni yuklab olishingiz mumkin bo'ladi.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWbSupplyDialogOpen(false)}>Bekor</Button>
            <Button onClick={handleWbConfirmWithSupply} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Postavka yaratish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Drop-off Point Dialog (Uzum) ===== */}
      <Dialog open={dropOffDialogOpen} onOpenChange={setDropOffDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Topshirish punkti
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.size} ta buyurtma uchun topshirish punkti va vaqtni tanlang
            </DialogDescription>
          </DialogHeader>

          {dropOffPoints.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : "Topshirish punktlari topilmadi"}
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {dropOffPoints.map((point: any, idx: number) => (
                <div key={idx}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPoint === String(point.id || point.dropOffPointId) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => handleSelectPoint(String(point.id || point.dropOffPointId))}
                >
                  <div className="font-medium text-sm">{point.address || point.name || `Punkt #${idx + 1}`}</div>
                  {point.remainingCapacity !== undefined && (
                    <Badge variant="outline" className="mt-1">{point.remainingCapacity} bo'sh joy</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {timeSlots.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Vaqt slotlari:</h4>
              <div className="grid grid-cols-2 gap-2">
                {timeSlots.map((slot: any, idx: number) => (
                  <div key={idx}
                    className={`p-2 border rounded text-sm cursor-pointer text-center ${selectedSlot === String(slot.id || slot.timeSlotId) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedSlot(String(slot.id || slot.timeSlotId))}
                  >
                    <div>{slot.date || slot.dateStr}</div>
                    <div className="text-xs text-muted-foreground">{slot.timeFrom} - {slot.timeTo}</div>
                    {slot.remainingCapacity !== undefined && (
                      <Badge variant={slot.remainingCapacity < 10 ? 'destructive' : 'secondary'} className="mt-1 text-[10px]">
                        {slot.remainingCapacity}/{slot.totalCapacity || '?'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDropOffDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSubmitDropOff} disabled={isLoading || !selectedPoint || !selectedSlot}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Qabul qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
