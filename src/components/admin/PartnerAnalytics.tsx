import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Search, Eye, Crown, Zap, DollarSign, Phone, MapPin,
  ShoppingCart, AlertTriangle, CheckCircle, Ban, Clock,
} from 'lucide-react';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'active' | 'debt' | 'blocked' | 'pending';

export function PartnerAnalytics() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [detailPeriod, setDetailPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data: partners, isLoading } = useQuery({
    queryKey: ['admin-partners'],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from('sellercloud_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      const userIds = subs?.map(s => s.user_id) || [];
      if (userIds.length === 0) return [];

      const [profilesRes, connectionsRes, aiRes, billingsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone, city, region, address').in('user_id', userIds),
        supabase.from('marketplace_connections').select('user_id, marketplace, is_active, total_revenue, products_count, orders_count').in('user_id', userIds),
        supabase.from('ai_usage_log').select('user_id, estimated_cost_usd, action_type').in('user_id', userIds),
        supabase.from('sellercloud_billing').select('user_id, balance_due, total_paid, status').in('user_id', userIds),
      ]);

      return subs?.map(sub => {
        const profile = profilesRes.data?.find(p => p.user_id === sub.user_id);
        const userConnections = connectionsRes.data?.filter(c => c.user_id === sub.user_id) || [];
        const userAI = aiRes.data?.filter(a => a.user_id === sub.user_id) || [];
        const userBillings = billingsRes.data?.filter(b => b.user_id === sub.user_id) || [];

        const aiCost = userAI.reduce((s, a) => s + (a.estimated_cost_usd || 0), 0);
        const totalRevenue = userConnections.reduce((s, c) => s + (c.total_revenue || 0), 0);
        const totalDebt = userBillings
          .filter(b => b.status === 'pending' || b.status === 'overdue')
          .reduce((s, b) => s + (b.balance_due || 0), 0);
        const totalPaid = userBillings.reduce((s, b) => s + (b.total_paid || 0), 0);

        // Determine partner status
        let partnerStatus: 'active' | 'debt' | 'blocked' | 'pending' = 'pending';
        if (!sub.is_active && sub.admin_override === false) {
          partnerStatus = 'blocked';
        } else if (totalDebt > 0) {
          partnerStatus = 'debt';
        } else if (sub.is_active) {
          partnerStatus = 'active';
        }

        return {
          ...sub,
          profile,
          connections: userConnections,
          aiCost,
          aiActions: userAI.length,
          totalRevenue,
          totalDebt,
          totalPaid,
          partnerStatus,
          marketplaces: [...new Set(userConnections.filter(c => c.is_active).map(c => c.marketplace))],
          totalProducts: userConnections.reduce((s, c) => s + (c.products_count || 0), 0),
          totalOrders: userConnections.reduce((s, c) => s + (c.orders_count || 0), 0),
        };
      }) || [];
    },
  });

  const { data: partnerDetail } = useQuery({
    queryKey: ['partner-detail', selectedPartner?.user_id, detailPeriod],
    enabled: !!selectedPartner,
    queryFn: async () => {
      const days = detailPeriod === '7d' ? 7 : detailPeriod === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: aiUsage } = await supabase
        .from('ai_usage_log')
        .select('action_type, estimated_cost_usd, model_used, created_at')
        .eq('user_id', selectedPartner.user_id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      const aiByDay: { date: string; cost: number; count: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayData = aiUsage?.filter(r => r.created_at.startsWith(dateStr)) || [];
        aiByDay.push({
          date: d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' }),
          cost: dayData.reduce((s, r) => s + (r.estimated_cost_usd || 0), 0),
          count: dayData.length,
        });
      }

      const actionMap = new Map<string, number>();
      aiUsage?.forEach(a => {
        actionMap.set(a.action_type, (actionMap.get(a.action_type) || 0) + 1);
      });

      return {
        aiByDay,
        aiByAction: Array.from(actionMap.entries()).map(([type, count]) => ({ type, count })),
        totalAICost: aiUsage?.reduce((s, a) => s + (a.estimated_cost_usd || 0), 0) || 0,
        totalActions: aiUsage?.length || 0,
      };
    },
  });

  const filteredPartners = partners
    ?.filter(p =>
      p.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.profile?.phone?.includes(search) ||
      p.user_id.includes(search)
    )
    .filter(p => statusFilter === 'all' || p.partnerStatus === statusFilter);

  const statusCounts = {
    all: partners?.length || 0,
    active: partners?.filter(p => p.partnerStatus === 'active').length || 0,
    debt: partners?.filter(p => p.partnerStatus === 'debt').length || 0,
    blocked: partners?.filter(p => p.partnerStatus === 'blocked').length || 0,
    pending: partners?.filter(p => p.partnerStatus === 'pending').length || 0,
  };

  const ACTION_LABELS: Record<string, string> = {
    product_scan: 'Skanerlash',
    infographic: 'Infografika',
    content_generation: 'Kontent',
    image_enhance: 'Rasm',
    pinterest_search: 'Pinterest',
  };

  const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    active: { label: 'Faol', icon: CheckCircle, color: 'bg-emerald-500' },
    debt: { label: 'Qarzdor', icon: AlertTriangle, color: 'bg-red-500' },
    blocked: { label: 'Bloklangan', icon: Ban, color: 'bg-destructive' },
    pending: { label: 'Kutilmoqda', icon: Clock, color: 'bg-amber-500' },
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Hamkorlar boshqaruvi</h2>
          <p className="text-sm text-muted-foreground">Barcha hamkorlarning holati, qarzdorligi va tahlili</p>
        </div>
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(['all', 'active', 'debt', 'blocked', 'pending'] as StatusFilter[]).map(status => {
          const config = status === 'all'
            ? { label: 'Hammasi', icon: Users, color: 'bg-primary' }
            : STATUS_CONFIG[status];
          const Icon = config.icon;
          return (
            <Card
              key={status}
              className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
              onClick={() => setStatusFilter(status)}
            >
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${config.color} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs text-muted-foreground">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Ism, telefon yoki ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {/* Partners Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hamkor</TableHead>
                <TableHead>Bog'lanish</TableHead>
                <TableHead>Tarif</TableHead>
                <TableHead>Marketplayslar</TableHead>
                <TableHead className="text-right">Daromad</TableHead>
                <TableHead className="text-right">AI rasxod</TableHead>
                <TableHead className="text-right">Qarzdorlik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners?.map(p => {
                const sc = STATUS_CONFIG[p.partnerStatus];
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{p.profile?.full_name || 'Noma\'lum'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.profile?.city || p.profile?.region || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {p.profile?.phone && (
                          <a href={`tel:${p.profile.phone}`} className="text-xs flex items-center gap-1 text-primary hover:underline">
                            <Phone className="h-3 w-3" />
                            {p.profile.phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.plan_type === 'pro' ? 'default' : 'secondary'}>
                        {p.plan_type === 'pro' ? 'Premium' : 'VIP'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.marketplaces.map((m: string) => (
                          <Badge key={m} variant="outline" className="text-xs capitalize">{m}</Badge>
                        ))}
                        {p.marketplaces.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {p.totalRevenue >= 1e6 ? (p.totalRevenue / 1e6).toFixed(1) + 'M' : p.totalRevenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">${p.aiCost.toFixed(2)}</TableCell>
                    <TableCell className={`text-right ${p.totalDebt > 0 ? 'text-red-600 font-bold' : ''}`}>
                      {p.totalDebt > 0 ? p.totalDebt.toLocaleString() + " so'm" : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${sc.color} text-xs text-white`}>{sc.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedPartner(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {(!filteredPartners || filteredPartners.length === 0) && (
            <p className="text-center text-muted-foreground py-8">Hamkorlar topilmadi</p>
          )}
        </CardContent>
      </Card>

      {/* Partner Detail Dialog */}
      <Dialog open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedPartner?.profile?.full_name || 'Hamkor'} — Batafsil
            </DialogTitle>
          </DialogHeader>

          {selectedPartner && (
            <div className="space-y-6">
              {/* Contact Info */}
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Bog'lanish ma'lumotlari</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-xs">Telefon</p>
                        {selectedPartner.profile?.phone ? (
                          <a href={`tel:${selectedPartner.profile.phone}`} className="font-medium text-primary hover:underline">
                            {selectedPartner.profile.phone}
                          </a>
                        ) : (
                          <p className="text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-xs">Manzil</p>
                        <p className="font-medium">
                          {[selectedPartner.profile?.city, selectedPartner.profile?.region].filter(Boolean).join(', ') || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Period selector */}
              <div className="flex justify-end">
                <Select value={detailPeriod} onValueChange={(v: '7d' | '30d' | '90d') => setDetailPeriod(v)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 kun</SelectItem>
                    <SelectItem value="30d">30 kun</SelectItem>
                    <SelectItem value="90d">90 kun</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Partner KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Buyurtmalar</p>
                    <p className="text-xl font-bold">{selectedPartner.totalOrders}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Daromad</p>
                    <p className="text-lg font-bold">{(selectedPartner.totalRevenue / 1e6).toFixed(1)}M</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />AI rasxod</p>
                    <p className="text-lg font-bold text-orange-600">${partnerDetail?.totalAICost.toFixed(2) || '0'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Qarzdorlik</p>
                    <p className={`text-lg font-bold ${selectedPartner.totalDebt > 0 ? 'text-red-600' : ''}`}>
                      {selectedPartner.totalDebt > 0 ? selectedPartner.totalDebt.toLocaleString() + " so'm" : '0'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Info Row */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Tarif</p>
                  <p className="font-medium">{selectedPartner.plan_type === 'pro' ? 'Premium ($499)' : 'Individual/VIP'}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Obuna sanasi</p>
                  <p className="font-medium">{format(new Date(selectedPartner.created_at), 'dd.MM.yyyy')}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Tovarlar</p>
                  <p className="font-medium">{selectedPartner.totalProducts}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Marketplayslar</p>
                  <p className="font-medium capitalize">{selectedPartner.marketplaces.join(', ') || 'Yo\'q'}</p>
                </div>
              </div>

              {/* AI Usage Chart */}
              <Card>
                <CardHeader><CardTitle className="text-sm">AI rasxodlar dinamikasi</CardTitle></CardHeader>
                <CardContent>
                  {partnerDetail?.aiByDay && partnerDetail.aiByDay.some(d => d.count > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={partnerDetail.aiByDay}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + v.toFixed(2)} />
                        <Tooltip formatter={(v: number) => '$' + v.toFixed(3)} />
                        <Bar dataKey="cost" fill="#f97316" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-6">Bu davrda AI foydalanish yo'q</p>
                  )}
                </CardContent>
              </Card>

              {/* AI Actions Breakdown */}
              {partnerDetail?.aiByAction && partnerDetail.aiByAction.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {partnerDetail.aiByAction.map(a => (
                    <div key={a.type} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm">{ACTION_LABELS[a.type] || a.type}</span>
                      <Badge variant="outline">{a.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
