import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Users, Eye, Crown } from 'lucide-react';
import { format } from 'date-fns';

export function PartnersDetails() {
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  // Fetch SellerCloudX subscribers
  const { data: sellerCloudUsers, isLoading: scLoading } = useQuery({
    queryKey: ['admin-sellercloud-detailed'],
    queryFn: async () => {
      const { data: subscriptions } = await supabase
        .from('sellercloud_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!subscriptions?.length) return [];

      const userIds = subscriptions.map(s => s.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, avatar_url')
        .in('user_id', userIds);
      const profilesMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p]));

      const enriched = await Promise.all(
        subscriptions.map(async (sub) => {
          const { data: billing } = await supabase
            .from('sellercloud_billing')
            .select('*')
            .eq('user_id', sub.user_id)
            .order('created_at', { ascending: false });

          const { data: connections } = await supabase
            .from('marketplace_connections')
            .select('marketplace, is_active, total_revenue, products_count, orders_count')
            .eq('user_id', sub.user_id);

          const totalDebt = billing?.filter(b => b.status !== 'paid').reduce((sum, b) => sum + Number(b.balance_due), 0) || 0;
          const totalPaid = billing?.filter(b => b.status === 'paid').reduce((sum, b) => sum + Number(b.total_paid), 0) || 0;

          return {
            ...sub,
            profiles: profilesMap[sub.user_id] || null,
            stats: {
              totalDebt,
              totalPaid,
              billing: billing || [],
              connections: connections || [],
            },
          };
        })
      );

      return enriched;
    },
  });

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
  };

  const filteredSC = sellerCloudUsers?.filter(s =>
    (s.profiles as any)?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.profiles as any)?.phone?.includes(search)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          SellerCloudX hamkorlar
        </CardTitle>
        <div className="flex items-center gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish (ism, telefon)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        {scLoading ? (
          <p className="text-center py-8">Yuklanmoqda...</p>
        ) : (
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foydalanuvchi</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ulanishlar</TableHead>
                  <TableHead>To'langan</TableHead>
                  <TableHead>Qarzdorlik</TableHead>
                  <TableHead className="text-right">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSC?.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium whitespace-nowrap">{(sub.profiles as any)?.full_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{sub.plan_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sub.is_active ? 'default' : 'destructive'} className="text-xs">
                        {sub.is_active ? 'Faol' : 'Nofaol'}
                      </Badge>
                      {sub.admin_override && <Badge className="ml-1 bg-amber-500 text-xs">Override</Badge>}
                    </TableCell>
                    <TableCell>{sub.stats?.connections?.length || 0}</TableCell>
                    <TableCell className="text-green-600 whitespace-nowrap">
                      {formatMoney(sub.stats?.totalPaid || 0)}
                    </TableCell>
                    <TableCell className="text-red-600 whitespace-nowrap">
                      {formatMoney(sub.stats?.totalDebt || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedPartner(sub)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        {/* Details Dialog */}
        <Dialog open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>SellerCloudX tafsilotlari</DialogTitle>
            </DialogHeader>

            {selectedPartner && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Foydalanuvchi</p>
                    <p className="font-medium">{(selectedPartner.profiles as any)?.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <p className="font-medium">{(selectedPartner.profiles as any)?.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tarif</p>
                    <p className="font-medium">{selectedPartner.plan_type} (${selectedPartner.monthly_fee}/oy + {selectedPartner.commission_percent}%)</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Boshlangan</p>
                    <p className="font-medium">{selectedPartner.started_at ? format(new Date(selectedPartner.started_at), 'dd.MM.yyyy') : '-'}</p>
                  </div>
                </div>

                {selectedPartner.stats?.connections?.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Ulangan marketpleyslar</h4>
                    <div className="space-y-2">
                      {selectedPartner.stats.connections.map((conn: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="font-medium">{conn.marketplace}</span>
                          <div className="flex gap-4 text-sm">
                            <span>{conn.products_count || 0} mahsulot</span>
                            <span>{conn.orders_count || 0} buyurtma</span>
                            <span className="text-green-600">{formatMoney(conn.total_revenue || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">To'lovlar tarixi</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Card className="bg-green-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-xl font-bold text-green-600">{formatMoney(selectedPartner.stats?.totalPaid || 0)}</p>
                        <p className="text-xs text-muted-foreground">To'langan</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-xl font-bold text-red-600">{formatMoney(selectedPartner.stats?.totalDebt || 0)}</p>
                        <p className="text-xs text-muted-foreground">Qarzdorlik</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
