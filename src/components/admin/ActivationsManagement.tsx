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
                    <TableHead>Oylik to'lov</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sana</TableHead>
                    <TableHead>Amal</TableHead>
                    <TableHead>Amal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCloud?.map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.profile?.full_name || 'Noma\'lum'}</TableCell>
                      <TableCell>
                        {sub.profile?.phone ? (
                          <a href={`tel:${sub.profile.phone}`} className="text-primary hover:underline text-sm">{sub.profile.phone}</a>
                        ) : '—'}
                      </TableCell>
                      <TableCell><Badge variant="secondary">{sub.plan_type?.toUpperCase()}</Badge></TableCell>
                      <TableCell>${sub.monthly_fee}</TableCell>
                      <TableCell>
                        {sub.is_active ? (
                          <Badge className="bg-emerald-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Faol</Badge>
                        ) : (
                          <Badge variant="outline" className="border-yellow-600 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(sub.created_at), 'dd.MM.yy')}</TableCell>
                      <TableCell>
                        {sub.is_active ? (
                          <Button size="sm" variant="outline" onClick={() => handleDeactivateCloud(sub.id)}>
                            <XCircle className="h-3 w-3 mr-1" /> O'chirish
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => handleApproveCloud(sub.id)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Aktivlashtirish
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
