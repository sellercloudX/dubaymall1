import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Store, Users, CheckCircle, XCircle, Clock, Search, Eye, ExternalLink, Globe } from 'lucide-react';
import { format } from 'date-fns';

export function ActivationsManagement() {
  const [activeTab, setActiveTab] = useState('cloud');
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch SellerCloudX subscriptions
  const { data: cloudSubscriptions, isLoading: loadingCloud } = useQuery({
    queryKey: ['admin-cloud-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellercloud_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profile info for each subscription
      const userIds = data?.map(s => s.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, city, region, address')
        .in('user_id', userIds);
      
      return data?.map(sub => ({
        ...sub,
        profile: profiles?.find(p => p.user_id === sub.user_id),
      })) || [];
    }
  });

  const handleApproveCloud = async (subscriptionId: string) => {
    try {
      const { error } = await supabase
        .from('sellercloud_subscriptions')
        .update({
          is_active: true,
          admin_override: true,
          admin_notes: 'Admin tomonidan aktivlashtirildi',
        })
        .eq('id', subscriptionId);

      if (error) throw error;
      toast.success('SellerCloudX aktivlashtirildi');
      queryClient.invalidateQueries({ queryKey: ['admin-cloud-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowDetailDialog(false);
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    }
  };

  const handleDeactivateCloud = async (subscriptionId: string) => {
    try {
      const { error } = await supabase
        .from('sellercloud_subscriptions')
        .update({
          is_active: false,
          admin_override: false,
        })
        .eq('id', subscriptionId);

      if (error) throw error;
      toast.success('SellerCloudX deaktivlashtirildi');
      queryClient.invalidateQueries({ queryKey: ['admin-cloud-subscriptions'] });
      setShowDetailDialog(false);
    } catch (err: any) {
      toast.error('Xatolik: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Faol</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rad</Badge>;
      default:
        return <Badge variant="outline" className="border-yellow-600 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>;
    }
  };

  const pendingCloudCount = cloudSubscriptions?.filter(s => !s.is_active && !s.admin_override).length || 0;

  const filteredCloud = cloudSubscriptions?.filter((s: any) => 
    s.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.plan_type?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivatsiya so'rovlari</CardTitle>
        <div className="flex items-center gap-2 mt-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="cloud" className="gap-2">
              <Globe className="h-4 w-4" />
              SellerCloudX
              {pendingCloudCount > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingCloudCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* SellerCloudX Tab */}
          <TabsContent value="cloud">
            {loadingCloud ? (
              <p className="text-center py-8 text-muted-foreground">Yuklanmoqda...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foydalanuvchi</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Tarif</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktivatsiya</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCloud?.map((sub: any) => {
                    const planType = (sub.plan_type || 'pro').toLowerCase();
                    const planBadge = planType === 'elegant'
                      ? <Badge className="bg-violet-500/10 text-violet-600 border-violet-200">Elegant</Badge>
                      : planType === 'premium'
                      ? <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">Premium</Badge>
                      : <Badge variant="secondary">Free</Badge>;
                    
                    const isActivePaid = sub.activation_paid_until && new Date(sub.activation_paid_until) > new Date();
                    
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.profile?.full_name || 'Noma\'lum'}</TableCell>
                        <TableCell>
                          {sub.profile?.phone ? (
                            <a href={`tel:${sub.profile.phone}`} className="text-primary hover:underline text-sm">{sub.profile.phone}</a>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {planBadge}
                            <select
                              className="text-[10px] border rounded px-1 py-0.5 bg-background w-20"
                              value={planType}
                              onChange={async (e) => {
                                const newPlan = e.target.value;
                                const { error } = await supabase
                                  .from('sellercloud_subscriptions')
                                  .update({ plan_type: newPlan })
                                  .eq('id', sub.id);
                                if (error) toast.error('Xatolik: ' + error.message);
                                else {
                                  toast.success(`Tarif ${newPlan} ga o'zgartirildi`);
                                  queryClient.invalidateQueries({ queryKey: ['admin-cloud-subscriptions'] });
                                }
                              }}
                            >
                              <option value="pro">Free</option>
                              <option value="premium">Premium</option>
                              <option value="elegant">Elegant</option>
                            </select>
                          </div>
                        </TableCell>
                        <TableCell>
                          {sub.is_active ? (
                            <Badge className="bg-emerald-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Faol</Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-600 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isActivePaid ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                              {format(new Date(sub.activation_paid_until), 'dd.MM.yy')} gacha
                            </Badge>
                          ) : sub.free_access ? (
                            <Badge className="bg-blue-100 text-blue-700 text-[10px]">Bepul</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">To'lanmagan</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{format(new Date(sub.created_at), 'dd.MM.yy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {sub.is_active ? (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDeactivateCloud(sub.id)}>
                                <XCircle className="h-3 w-3 mr-1" /> O'chirish
                              </Button>
                            ) : (
                              <Button size="sm" className="h-7 text-xs" onClick={() => handleApproveCloud(sub.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Aktivlashtirish
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {cloudSubscriptions?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">SellerCloudX so'rovlari yo'q</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
