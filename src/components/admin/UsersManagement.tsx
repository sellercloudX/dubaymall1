import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Label } from '@/components/ui/label';
import { useAdminUsers } from '@/hooks/useAdminStats';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, UserPlus, Shield, UserCog, Trash2, Crown } from 'lucide-react';
import { format } from 'date-fns';

const roleColors: Record<string, string> = {
  admin: 'bg-red-500',
  seller: 'bg-blue-500',
  blogger: 'bg-purple-500',
  buyer: 'bg-green-500',
  sellercloud: 'bg-amber-500',
};

 const roleLabels: Record<string, string> = {
   seller: 'Sotuvchi',
   blogger: 'Blogger',
   admin: 'Admin',
   sellercloud: 'SellerCloudX',
 };
 
export function UsersManagement() {
  const { data: users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');
   const [showRoleDialog, setShowRoleDialog] = useState(false);
   const [selectedUser, setSelectedUser] = useState<any>(null);
   const [selectedRole, setSelectedRole] = useState<string>('');
   const [grantingSellerCloud, setGrantingSellerCloud] = useState(false);
  const queryClient = useQueryClient();

  const filteredUsers = users?.filter(user => 
    user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    user.phone?.includes(search)
  );

   const addRole = async () => {
     if (!selectedUser || !selectedRole) return;
     
     // Handle SellerCloudX separately - create subscription
     if (selectedRole === 'sellercloud') {
       await grantSellerCloudAccess();
       return;
     }
     
    try {
      const { error } = await supabase
        .from('user_roles')
         .insert({ user_id: selectedUser.user_id, role: selectedRole as 'admin' | 'blogger' | 'buyer' | 'seller' });

      if (error) throw error;
       toast.success(`${roleLabels[selectedRole] || selectedRole} roli qo'shildi`);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
       setShowRoleDialog(false);
       setSelectedUser(null);
       setSelectedRole('');
    } catch (err) {
      toast.error("Rol qo'shishda xatolik");
    }
  };

   const grantSellerCloudAccess = async () => {
     if (!selectedUser) return;
     setGrantingSellerCloud(true);
     
     try {
       // Check if subscription already exists
       const { data: existing } = await supabase
         .from('sellercloud_subscriptions')
         .select('id')
         .eq('user_id', selectedUser.user_id)
         .maybeSingle();
       
       if (existing) {
         // Update existing to active with admin override
         const { error } = await supabase
           .from('sellercloud_subscriptions')
           .update({ 
             is_active: true, 
             admin_override: true,
             admin_notes: 'Admin tomonidan aktivlashtirildi'
           })
           .eq('id', existing.id);
         
         if (error) throw error;
       } else {
         // Create new subscription with admin override
         const { error } = await supabase
           .from('sellercloud_subscriptions')
           .insert({
             user_id: selectedUser.user_id,
             plan_type: 'pro',
             monthly_fee: 499,
             commission_percent: 4,
             is_active: true,
             is_trial: false,
             admin_override: true,
             admin_notes: 'Admin tomonidan yaratildi',
             started_at: new Date().toISOString(),
           });
         
         if (error) throw error;
       }
       
       toast.success('SellerCloudX ruxsati berildi');
       queryClient.invalidateQueries({ queryKey: ['admin-users'] });
       setShowRoleDialog(false);
       setSelectedUser(null);
       setSelectedRole('');
     } catch (err: any) {
       toast.error("Xatolik: " + err.message);
     } finally {
       setGrantingSellerCloud(false);
     }
   };

   const removeRole = async (userId: string, role: string) => {
     if (role === 'buyer') {
       toast.error("Xaridor rolini olib bo'lmaydi");
       return;
     }
     
     // Handle SellerCloudX separately
     if (role === 'sellercloud') {
       try {
         const { error } = await supabase
           .from('sellercloud_subscriptions')
           .update({ is_active: false, admin_override: false })
           .eq('user_id', userId);
         
         if (error) throw error;
         toast.success('SellerCloudX ruxsati olib tashlandi');
         queryClient.invalidateQueries({ queryKey: ['admin-users'] });
       } catch (err) {
         toast.error("Xatolik yuz berdi");
       }
       return;
     }
     
     try {
       const { error } = await supabase
         .from('user_roles')
         .delete()
         .eq('user_id', userId)
         .eq('role', role as 'admin' | 'blogger' | 'buyer' | 'seller');
 
       if (error) throw error;
       toast.success(`${roleLabels[role] || role} roli olib tashlandi`);
       queryClient.invalidateQueries({ queryKey: ['admin-users'] });
     } catch (err) {
       toast.error("Rolni olib tashlashda xatolik");
     }
   };
 
   const openRoleDialog = (user: any) => {
     setSelectedUser(user);
     setSelectedRole('');
     setShowRoleDialog(true);
   };
 
   const getAvailableRoles = (currentRoles: string[]) => {
     const allRoles = ['seller', 'blogger', 'sellercloud'];
     return allRoles.filter(r => !currentRoles?.includes(r));
   };
 
  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Foydalanuvchilar boshqaruvi
        </CardTitle>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ism</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Rollar</TableHead>
              <TableHead>Ro'yxatdan o'tgan</TableHead>
              <TableHead>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers?.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || 'Noma\'lum'}</TableCell>
                <TableCell>{user.phone || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles?.map((role: string) => (
                       <Badge 
                         key={role} 
                         className={`${roleColors[role] || 'bg-gray-500'} cursor-pointer`}
                         onClick={() => role !== 'buyer' && removeRole(user.user_id, role)}
                         title={role !== 'buyer' ? "Bosib olib tashlash" : ""}
                       >
                        {role}
                         {role !== 'buyer' && <Trash2 className="h-3 w-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{format(new Date(user.created_at), 'dd.MM.yyyy')}</TableCell>
                <TableCell>
                   {getAvailableRoles(user.roles).length > 0 && (
                     <Button size="sm" variant="outline" onClick={() => openRoleDialog(user)}>
                       <UserCog className="h-3 w-3 mr-1" />
                       Rol qo'shish
                     </Button>
                   )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredUsers?.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Foydalanuvchilar topilmadi</p>
        )}
         
         {/* Add Role Dialog */}
         <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Rol qo'shish</DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
               <div>
                 <Label>Foydalanuvchi</Label>
                 <p className="text-sm font-medium mt-1">{selectedUser?.full_name || selectedUser?.phone || 'Noma\'lum'}</p>
               </div>
               <div>
                 <Label>Rol</Label>
                 <Select value={selectedRole} onValueChange={setSelectedRole}>
                   <SelectTrigger>
                     <SelectValue placeholder="Rol tanlang" />
                   </SelectTrigger>
                   <SelectContent>
                     {selectedUser && getAvailableRoles(selectedUser.roles).map((role) => (
                       <SelectItem key={role} value={role}>
                         {roleLabels[role] || role}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <p className="text-xs text-muted-foreground">
                 Eslatma: Rol qo'shilganda foydalanuvchi aktivatsiya jo'natmasdan ham o'z kabinetiga kira oladi.
               </p>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Bekor</Button>
                <Button onClick={addRole} disabled={!selectedRole || grantingSellerCloud}>
                 <UserPlus className="h-4 w-4 mr-2" />
                  {grantingSellerCloud ? 'Yuklanmoqda...' : 'Qo\'shish'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
      </CardContent>
    </Card>
  );
}
