import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, TrendingUp, Users, Store, 
  Clock, CheckCircle, XCircle, RefreshCw 
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function AdminFinancials() {
  const [processingPayouts, setProcessingPayouts] = useState(false);

  // Platform revenue summary
  const { data: revenueStats, isLoading: revenueLoading } = useQuery({
    queryKey: ['admin-revenue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_revenue')
        .select('amount, source_type, created_at');
      if (error) throw error;

      const total = data?.reduce((sum, r) => sum + r.amount, 0) || 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRevenue = data?.filter(r => new Date(r.created_at) >= today)
        .reduce((sum, r) => sum + r.amount, 0) || 0;

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const monthRevenue = data?.filter(r => new Date(r.created_at) >= thisMonth)
        .reduce((sum, r) => sum + r.amount, 0) || 0;

      return { total, todayRevenue, monthRevenue, records: data || [] };
    },
  });

  // Order financials
  const { data: orderFinancials, isLoading: financialsLoading, refetch: refetchFinancials } = useQuery({
    queryKey: ['admin-order-financials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_financials')
        .select(`
          *,
          orders (order_number, status, delivery_confirmed_at, created_at),
          shops (name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Seller withdrawal requests
  const { data: sellerWithdrawals, refetch: refetchSellerWithdrawals } = useQuery({
    queryKey: ['admin-seller-withdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_withdrawal_requests')
        .select(`
          *,
          shops (name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Blogger withdrawal requests
  const { data: bloggerWithdrawals, refetch: refetchBloggerWithdrawals } = useQuery({
    queryKey: ['admin-blogger-withdrawals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleProcessPayouts = async () => {
    setProcessingPayouts(true);
    try {
      const { data, error } = await supabase.rpc('process_pending_payouts');
      if (error) throw error;
      toast.success(`${data} ta payout qayta ishlandi`);
      refetchFinancials();
    } catch (error: any) {
      toast.error(error.message || 'Xatolik yuz berdi');
    } finally {
      setProcessingPayouts(false);
    }
  };

  const handleUpdateWithdrawalStatus = async (
    type: 'seller' | 'blogger',
    id: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      const table = type === 'seller' ? 'seller_withdrawal_requests' : 'withdrawal_requests';
      const { error } = await supabase
        .from(table)
        .update({ 
          status, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(status === 'approved' ? 'Tasdiqlandi' : 'Rad etildi');
      
      if (type === 'seller') {
        refetchSellerWithdrawals();
      } else {
        refetchBloggerWithdrawals();
      }
    } catch (error: any) {
      toast.error(error.message || 'Xatolik');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>;
      case 'ready':
        return <Badge className="bg-blue-600"><RefreshCw className="h-3 w-3 mr-1" /> Tayyor</Badge>;
      case 'approved':
        return <Badge className="bg-emerald-600"><CheckCircle className="h-3 w-3 mr-1" /> Tasdiqlangan</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-600"><CheckCircle className="h-3 w-3 mr-1" /> Bajarildi</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rad etildi</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Jami daromad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : `${(revenueStats?.total || 0).toLocaleString()} so'm`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Bu oy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {revenueLoading ? '...' : `${(revenueStats?.monthRevenue || 0).toLocaleString()} so'm`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-100 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Sotuvchi so'rovlari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sellerWithdrawals?.filter(w => w.status === 'pending').length || 0}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Blogger so'rovlari
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {bloggerWithdrawals?.filter(w => w.status === 'pending').length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleProcessPayouts} 
          disabled={processingPayouts}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${processingPayouts ? 'animate-spin' : ''}`} />
          Payoutlarni qayta ishlash
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financials" className="space-y-4">
        <TabsList>
          <TabsTrigger value="financials">Buyurtma moliyasi</TabsTrigger>
          <TabsTrigger value="seller-withdrawals">Sotuvchi so'rovlari</TabsTrigger>
          <TabsTrigger value="blogger-withdrawals">Blogger so'rovlari</TabsTrigger>
          <TabsTrigger value="revenue">Platform daromadi</TabsTrigger>
        </TabsList>

        <TabsContent value="financials">
          <Card>
            <CardHeader>
              <CardTitle>Buyurtma moliyaviy tafsilotlari</CardTitle>
            </CardHeader>
            <CardContent>
              {financialsLoading ? (
                <p className="text-center py-4 text-muted-foreground">Yuklanmoqda...</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Buyurtma</TableHead>
                        <TableHead>Do'kon</TableHead>
                        <TableHead className="text-right">Summa</TableHead>
                        <TableHead className="text-right">Platform</TableHead>
                        <TableHead className="text-right">Blogger</TableHead>
                        <TableHead className="text-right">Sotuvchi</TableHead>
                        <TableHead>Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderFinancials?.map((f: any) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-mono text-sm">
                            {f.orders?.order_number || '-'}
                          </TableCell>
                          <TableCell>{f.shops?.name || '-'}</TableCell>
                          <TableCell className="text-right">
                            {f.order_total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-emerald-600">
                            {f.platform_commission_amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            {(f.blogger_commission_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {f.seller_net_amount.toLocaleString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(f.payout_status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seller-withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Sotuvchi pul yechish so'rovlari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Do'kon</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>To'lov usuli</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead>Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerWithdrawals?.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(w.created_at), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{w.shops?.name || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {w.amount.toLocaleString()} so'm
                        </TableCell>
                        <TableCell className="capitalize">{w.payment_method}</TableCell>
                        <TableCell>{getStatusBadge(w.status)}</TableCell>
                        <TableCell>
                          {w.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateWithdrawalStatus('seller', w.id, 'approved')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Tasdiqlash
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleUpdateWithdrawalStatus('seller', w.id, 'rejected')}
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Rad etish
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blogger-withdrawals">
          <Card>
            <CardHeader>
              <CardTitle>Blogger pul yechish so'rovlari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead>To'lov usuli</TableHead>
                      <TableHead>Holat</TableHead>
                      <TableHead>Amallar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bloggerWithdrawals?.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(w.created_at), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {w.amount.toLocaleString()} so'm
                        </TableCell>
                        <TableCell className="capitalize">{w.payment_method}</TableCell>
                        <TableCell>{getStatusBadge(w.status)}</TableCell>
                        <TableCell>
                          {w.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateWithdrawalStatus('blogger', w.id, 'approved')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Tasdiqlash
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleUpdateWithdrawalStatus('blogger', w.id, 'rejected')}
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Rad etish
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Platform daromad tarixi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sana</TableHead>
                      <TableHead>Manba</TableHead>
                      <TableHead>Tavsif</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueStats?.records.slice(0, 50).map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(r.created_at), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="capitalize">{r.source_type}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {r.description || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          +{r.amount.toLocaleString()} so'm
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
