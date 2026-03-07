import { useState, useMemo } from 'react';
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
import {
  Package, CheckCircle, XCircle, Printer, Truck, RefreshCw, Loader2,
  ClipboardList, MapPin, AlertTriangle,
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

// FBS Status tabs per marketplace
const FBS_TABS = [
  { key: 'new', label: 'Yangilar', statuses: ['CREATED', 'new', 'PROCESSING'], icon: Package },
  { key: 'assembly', label: "Yig'ishdagi", statuses: ['PACKING', 'confirm', 'READY_TO_SHIP'], icon: ClipboardList },
  { key: 'shipping', label: 'Yetkazishda', statuses: ['PENDING_DELIVERY', 'DELIVERY', 'DELIVERING', 'complete'], icon: Truck },
  { key: 'delivered', label: 'Topshirilgan', statuses: ['DELIVERED', 'COMPLETED', 'ACCEPTED_AT_DP', 'DELIVERED_TO_CUSTOMER_DELIVERY_POINT'], icon: CheckCircle },
  { key: 'cancelled', label: 'Bekor', statuses: ['CANCELLED', 'CANCELED', 'RETURNED', 'cancel'], icon: XCircle },
];

const normalizeOfferKey = (v?: string) => String(v || '').trim().toLowerCase();

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

  const {
    isLoading, actionInProgress, confirmOrders, cancelOrders, getLabels,
    getDropOffPoints, getTimeSlots, createInvoice, setDropOff,
  } = useOrderManagement();

  const allOrders = store.getOrders(selectedMp);

  // Group orders by FBS tab
  const ordersByTab = useMemo(() => {
    const map: Record<string, MarketplaceOrder[]> = {};
    for (const tab of FBS_TABS) {
      map[tab.key] = allOrders.filter(o =>
        tab.statuses.some(s => o.status?.toUpperCase() === s.toUpperCase())
      );
    }
    return map;
  }, [allOrders]);

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

  const handleConfirm = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return toast.warning("Buyurtma tanlang");
    try {
      await confirmOrders(selectedMp, ids);
      setSelectedOrders(new Set());
      store.refetchOrders(selectedMp);
    } catch {}
  };

  const handleCancel = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    try {
      await cancelOrders(selectedMp, ids, cancelReason);
      setCancelDialogOpen(false);
      setSelectedOrders(new Set());
      store.refetchOrders(selectedMp);
    } catch {}
  };

  const handlePrintLabels = async () => {
    const ids = getSelectedIds();
    if (ids.length === 0) return toast.warning("Buyurtma tanlang");
    try {
      const result = await getLabels(selectedMp, ids);
      if (selectedMp === 'wildberries' && result?.stickers) {
        // WB returns base64 PNG stickers
        result.stickers.forEach((s: any) => {
          if (s.file) {
            const link = document.createElement('a');
            link.href = `data:image/png;base64,${s.file}`;
            link.download = `sticker_${s.orderId || 'wb'}.png`;
            link.click();
          }
        });
        toast.success(`${result.stickers.length} ta stiker yuklandi`);
      } else {
        toast.success("Etiketka tayyor");
      }
    } catch {}
  };

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
      // First create invoice, then set drop-off
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
    if (['CANCELLED', 'CANCELED', 'RETURNED'].includes(s)) return 'destructive';
    if (['DELIVERED', 'COMPLETED'].includes(s)) return 'default';
    if (['PACKING', 'PROCESSING', 'READY_TO_SHIP'].includes(s)) return 'secondary';
    return 'outline';
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {tab.label}
                    <Badge variant="outline">{currentOrders.length} ta</Badge>
                  </CardTitle>

                  {/* Action buttons */}
                  {selectedOrders.size > 0 && (
                    <div className="flex gap-2">
                      {(activeTab === 'new') && (
                        <Button size="sm" onClick={handleConfirm} disabled={isLoading}>
                          {actionInProgress === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                          Tasdiqlash ({selectedOrders.size})
                        </Button>
                      )}
                      {(activeTab === 'assembly' && selectedMp === 'uzum') && (
                        <Button size="sm" variant="outline" onClick={handleDropOff} disabled={isLoading}>
                          <MapPin className="h-4 w-4 mr-1" />
                          Topshirish punkti
                        </Button>
                      )}
                      {(activeTab === 'new' || activeTab === 'assembly') && (
                        <Button size="sm" variant="outline" onClick={handlePrintLabels} disabled={isLoading}>
                          {actionInProgress === 'labels' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Printer className="h-4 w-4 mr-1" />}
                          Etiketka
                        </Button>
                      )}
                      {(activeTab === 'new' || activeTab === 'assembly') && (
                        <Button size="sm" variant="destructive" onClick={() => setCancelDialogOpen(true)} disabled={isLoading}>
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
                          <span className="w-24 font-mono text-sm">{order.id}</span>
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

      {/* Cancel Dialog */}
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
              <SelectItem value="SELLER_CANCEL">Sotuvchi bekor qildi</SelectItem>
              <SelectItem value="OUT_OF_STOCK">Tovar tugadi</SelectItem>
              <SelectItem value="WRONG_PRICE">Narx xato</SelectItem>
              <SelectItem value="OTHER">Boshqa sabab</SelectItem>
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

      {/* Drop-off Point Dialog (Uzum) */}
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
