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
   const [activeTab, setActiveTab] = useState('sellers');
   const [search, setSearch] = useState('');
   const [selectedItem, setSelectedItem] = useState<any>(null);
   const [showDetailDialog, setShowDetailDialog] = useState(false);
   const [rejectionReason, setRejectionReason] = useState('');
   const queryClient = useQueryClient();
 
   // Fetch seller profiles
    const { data: sellerProfiles, isLoading: loadingSellers } = useQuery({
      queryKey: ['admin-seller-profiles'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('seller_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Fetch profile info separately (no FK relationship)
        const userIds = data?.map(s => s.user_id) || [];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, phone')
            .in('user_id', userIds);
          
          return data?.map(seller => ({
            ...seller,
            profiles: profiles?.find(p => p.user_id === seller.user_id) || null,
          })) || [];
        }
        return data || [];
      }
    });
  
    // Fetch blogger profiles
    const { data: bloggerProfiles, isLoading: loadingBloggers } = useQuery({
      queryKey: ['admin-blogger-profiles'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('blogger_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Fetch profile info separately
        const userIds = data?.map(b => b.user_id) || [];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, phone')
            .in('user_id', userIds);
          
          return data?.map(blogger => ({
            ...blogger,
            profiles: profiles?.find(p => p.user_id === blogger.user_id) || null,
          })) || [];
        }
        return data || [];
      }
    });

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
         .select('user_id, full_name, phone')
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

   const handleApprove = async (type: 'seller' | 'blogger', id: string, userId: string) => {
     try {
       const table = type === 'seller' ? 'seller_profiles' : 'blogger_profiles';
       const role = type === 'seller' ? 'seller' : 'blogger';
       
       // Update profile status
       const { error: profileError } = await supabase
         .from(table)
         .update({
           status: 'approved',
           approved_at: new Date().toISOString(),
         })
         .eq('id', id);
 
       if (profileError) throw profileError;
 
       // Add role to user_roles table
       const { error: roleError } = await supabase
         .from('user_roles')
         .insert({ user_id: userId, role: role as 'seller' | 'blogger' })
         .select()
         .single();
 
       // Ignore if role already exists
       if (roleError && !roleError.message.includes('duplicate')) {
         console.warn('Role might already exist:', roleError.message);
       }
 
       // Create balance record for blogger
       if (type === 'blogger') {
         await supabase
           .from('blogger_balances')
           .insert({ user_id: userId })
           .select()
           .single();
       }
 
       toast.success('Muvaffaqiyatli aktivlashtirildi va rol qo\'shildi');
       queryClient.invalidateQueries({ queryKey: [`admin-${type}-profiles`] });
       queryClient.invalidateQueries({ queryKey: ['admin-users'] });
       setShowDetailDialog(false);
     } catch (err: any) {
       toast.error('Xatolik: ' + err.message);
     }
   };
 
   const handleReject = async (type: 'seller' | 'blogger', id: string) => {
     if (!rejectionReason) {
       toast.error('Rad etish sababini kiriting');
       return;
     }
 
     try {
       const table = type === 'seller' ? 'seller_profiles' : 'blogger_profiles';
       
       const { error } = await supabase
         .from(table)
         .update({
           status: 'rejected',
           rejection_reason: rejectionReason,
         })
         .eq('id', id);
 
       if (error) throw error;
 
       toast.success('Rad etildi');
       queryClient.invalidateQueries({ queryKey: [`admin-${type}-profiles`] });
       setShowDetailDialog(false);
       setRejectionReason('');
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
         return <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>;
     }
   };
 
    const filteredSellers = sellerProfiles?.filter((s: any) => 
      s.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.inn?.includes(search) ||
      s.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    );
  
    const filteredBloggers = bloggerProfiles?.filter((b: any) => 
      b.social_username?.toLowerCase().includes(search.toLowerCase()) ||
      b.social_platform?.toLowerCase().includes(search.toLowerCase()) ||
      b.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    );
 
    const pendingCloudCount = cloudSubscriptions?.filter(s => !s.is_active && !s.admin_override).length || 0;

    const pendingCount = {
      sellers: sellerProfiles?.filter(s => s.status === 'pending').length || 0,
      bloggers: bloggerProfiles?.filter(b => b.status === 'pending').length || 0,
      cloud: pendingCloudCount,
    };
 
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
             <TabsTrigger value="sellers" className="gap-2">
               <Store className="h-4 w-4" />
               Sotuvchilar
               {pendingCount.sellers > 0 && (
                 <Badge variant="destructive" className="ml-1">{pendingCount.sellers}</Badge>
               )}
             </TabsTrigger>
             <TabsTrigger value="bloggers" className="gap-2">
               <Users className="h-4 w-4" />
               Bloggerlar
               {pendingCount.bloggers > 0 && (
                 <Badge variant="destructive" className="ml-1">{pendingCount.bloggers}</Badge>
               )}
              </TabsTrigger>
              <TabsTrigger value="cloud" className="gap-2">
                <Globe className="h-4 w-4" />
                SellerCloudX
                {pendingCount.cloud > 0 && (
                  <Badge variant="destructive" className="ml-1">{pendingCount.cloud}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
 
           <TabsContent value="sellers">
             {loadingSellers ? (
               <p className="text-center py-8 text-muted-foreground">Yuklanmoqda...</p>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Biznes nomi</TableHead>
                     <TableHead>Turi</TableHead>
                     <TableHead>INN</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Sana</TableHead>
                     <TableHead>Amal</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredSellers?.map((seller) => (
                     <TableRow key={seller.id}>
                       <TableCell className="font-medium">{seller.business_name || '-'}</TableCell>
                       <TableCell>{seller.business_type?.toUpperCase()}</TableCell>
                       <TableCell>{seller.inn || '-'}</TableCell>
                       <TableCell>{getStatusBadge(seller.status)}</TableCell>
                       <TableCell>
                         {seller.submitted_at ? format(new Date(seller.submitted_at), 'dd.MM.yy') : '-'}
                       </TableCell>
                       <TableCell>
                         <Button 
                           size="sm" 
                           variant="outline"
                           onClick={() => {
                             setSelectedItem({ ...seller, type: 'seller' });
                             setShowDetailDialog(true);
                           }}
                         >
                           <Eye className="h-4 w-4 mr-1" />
                           Ko'rish
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
           </TabsContent>
 
           <TabsContent value="bloggers">
             {loadingBloggers ? (
               <p className="text-center py-8 text-muted-foreground">Yuklanmoqda...</p>
             ) : (
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Username</TableHead>
                     <TableHead>Platforma</TableHead>
                     <TableHead>Obunachilar</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead>Sana</TableHead>
                     <TableHead>Amal</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filteredBloggers?.map((blogger) => (
                     <TableRow key={blogger.id}>
                       <TableCell className="font-medium">@{blogger.social_username || '-'}</TableCell>
                       <TableCell className="capitalize">{blogger.social_platform}</TableCell>
                       <TableCell>{blogger.followers_count?.toLocaleString() || '-'}</TableCell>
                       <TableCell>{getStatusBadge(blogger.status)}</TableCell>
                       <TableCell>
                         {blogger.submitted_at ? format(new Date(blogger.submitted_at), 'dd.MM.yy') : '-'}
                       </TableCell>
                       <TableCell>
                         <Button 
                           size="sm" 
                           variant="outline"
                           onClick={() => {
                             setSelectedItem({ ...blogger, type: 'blogger' });
                             setShowDetailDialog(true);
                           }}
                         >
                           <Eye className="h-4 w-4 mr-1" />
                           Ko'rish
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             )}
            </TabsContent>

            {/* SellerCloudX Tab */}
            <TabsContent value="cloud">
              {loadingCloud ? (
                <p className="text-center py-8 text-muted-foreground">Yuklanmoqda...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foydalanuvchi</TableHead>
                      <TableHead>Tarif</TableHead>
                      <TableHead>Oylik to'lov</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sana</TableHead>
                      <TableHead>Amal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cloudSubscriptions?.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.profile?.full_name || 'Noma\'lum'}</TableCell>
                        <TableCell><Badge variant="secondary">{sub.plan_type?.toUpperCase()}</Badge></TableCell>
                        <TableCell>${sub.monthly_fee}</TableCell>
                        <TableCell>
                          {sub.is_active ? (
                            <Badge className="bg-emerald-500 text-white"><CheckCircle className="h-3 w-3 mr-1" /> Faol</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-600"><Clock className="h-3 w-3 mr-1" /> Kutilmoqda</Badge>
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
 
          {/* Detail Dialog */}
          <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {selectedItem?.type === 'seller' ? 'Sotuvchi ma\'lumotlari' : 'Blogger ma\'lumotlari'}
                </DialogTitle>
             </DialogHeader>
             
             {selectedItem && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   {selectedItem.type === 'seller' ? (
                     <>
                       <div>
                         <p className="text-muted-foreground">Biznes nomi</p>
                         <p className="font-medium">{selectedItem.business_name}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Turi</p>
                         <p className="font-medium">{selectedItem.business_type?.toUpperCase()}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">INN</p>
                         <p className="font-medium">{selectedItem.inn}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">OKED</p>
                         <p className="font-medium">{selectedItem.oked || '-'}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Bank</p>
                         <p className="font-medium">{selectedItem.bank_name}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">MFO</p>
                         <p className="font-medium">{selectedItem.bank_mfo}</p>
                       </div>
                       <div className="col-span-2">
                         <p className="text-muted-foreground">Hisob raqam</p>
                         <p className="font-medium font-mono">{selectedItem.bank_account}</p>
                       </div>
                       <div className="col-span-2">
                         <p className="text-muted-foreground">Manzil</p>
                         <p className="font-medium">{selectedItem.legal_address}</p>
                       </div>
                     </>
                   ) : (
                     <>
                       <div>
                         <p className="text-muted-foreground">Platforma</p>
                         <p className="font-medium capitalize">{selectedItem.social_platform}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Username</p>
                         <p className="font-medium">@{selectedItem.social_username}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Obunachilar</p>
                         <p className="font-medium">{selectedItem.followers_count?.toLocaleString()}</p>
                       </div>
                       <div>
                         <p className="text-muted-foreground">Yo'nalish</p>
                         <p className="font-medium capitalize">{selectedItem.niche || '-'}</p>
                       </div>
                       <div className="col-span-2">
                         <p className="text-muted-foreground">Profil havolasi</p>
                         <a 
                           href={selectedItem.social_url} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-primary hover:underline break-all"
                         >
                           {selectedItem.social_url}
                         </a>
                       </div>
                       {selectedItem.description && (
                         <div className="col-span-2">
                           <p className="text-muted-foreground">Tavsif</p>
                           <p className="font-medium">{selectedItem.description}</p>
                         </div>
                       )}
                     </>
                   )}
                 </div>
 
                 {selectedItem.status === 'pending' && (
                   <div className="space-y-3 pt-4 border-t">
                     <Textarea
                       placeholder="Rad etish sababi (ixtiyoriy)..."
                       value={rejectionReason}
                       onChange={(e) => setRejectionReason(e.target.value)}
                     />
                   </div>
                 )}
               </div>
             )}
 
             <DialogFooter className="gap-2">
               {selectedItem?.status === 'pending' && (
                 <>
                   <Button
                     variant="destructive"
                     onClick={() => handleReject(selectedItem.type, selectedItem.id)}
                   >
                     <XCircle className="h-4 w-4 mr-2" />
                     Rad etish
                   </Button>
                   <Button
                     onClick={() => handleApprove(selectedItem.type, selectedItem.id, selectedItem.user_id)}
                   >
                     <CheckCircle className="h-4 w-4 mr-2" />
                     Tasdiqlash
                   </Button>
                 </>
               )}
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </CardContent>
     </Card>
   );
 }