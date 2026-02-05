 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Switch } from '@/components/ui/switch';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Label } from '@/components/ui/label';
 import { useAdminPermissions } from '@/hooks/useAdminPermissions';
 import { useAdminUsers } from '@/hooks/useAdminStats';
 import { Shield, UserPlus, Settings, Trash2, Crown } from 'lucide-react';
 import { format } from 'date-fns';
 
 const permissionLabels: Record<string, string> = {
   can_manage_users: "Foydalanuvchilar",
   can_manage_products: "Mahsulotlar",
   can_manage_orders: "Buyurtmalar",
   can_manage_shops: "Do'konlar",
   can_manage_activations: "Aktivatsiya",
   can_manage_finances: "Moliya",
   can_manage_content: "Kontent",
   can_add_admins: "Admin qo'shish",
 };
 
 export function AdminsManagement() {
   const { isSuperAdmin, allAdmins, loadingAdmins, addAdmin, updateAdminPermissions, removeAdmin } = useAdminPermissions();
   const { data: users } = useAdminUsers();
   const [showAddDialog, setShowAddDialog] = useState(false);
   const [showEditDialog, setShowEditDialog] = useState(false);
   const [selectedUserId, setSelectedUserId] = useState('');
   const [selectedAdmin, setSelectedAdmin] = useState<any>(null);
   const [newPerms, setNewPerms] = useState<Record<string, boolean>>({});
 
   // Users who are not yet admins
   const nonAdminUsers = users?.filter(u => !u.roles?.includes('admin')) || [];
 
   const handleAddAdmin = async () => {
     if (!selectedUserId) return;
     await addAdmin.mutateAsync({ userId: selectedUserId, perms: newPerms });
     setShowAddDialog(false);
     setSelectedUserId('');
     setNewPerms({});
   };
 
   const handleUpdatePermissions = async () => {
     if (!selectedAdmin) return;
     await updateAdminPermissions.mutateAsync({ userId: selectedAdmin.user_id, perms: newPerms });
     setShowEditDialog(false);
     setSelectedAdmin(null);
     setNewPerms({});
   };
 
   const handleRemoveAdmin = async (userId: string) => {
     if (confirm("Bu adminni olib tashlamoqchimisiz?")) {
       await removeAdmin.mutateAsync(userId);
     }
   };
 
   const openEditDialog = (admin: any) => {
     setSelectedAdmin(admin);
     setNewPerms({
       can_manage_users: admin.can_manage_users,
       can_manage_products: admin.can_manage_products,
       can_manage_orders: admin.can_manage_orders,
       can_manage_shops: admin.can_manage_shops,
       can_manage_activations: admin.can_manage_activations,
       can_manage_finances: admin.can_manage_finances,
       can_manage_content: admin.can_manage_content,
       can_add_admins: admin.can_add_admins,
     });
     setShowEditDialog(true);
   };
 
   if (!isSuperAdmin) {
     return (
       <Card>
         <CardContent className="py-8 text-center">
           <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
           <p className="text-muted-foreground">Bu bo'limga faqat Super Admin kira oladi</p>
         </CardContent>
       </Card>
     );
   }
 
   return (
     <Card>
       <CardHeader className="flex flex-row items-center justify-between">
         <CardTitle className="flex items-center gap-2">
           <Crown className="h-5 w-5 text-amber-500" />
           Adminlar boshqaruvi
         </CardTitle>
         <Button onClick={() => setShowAddDialog(true)}>
           <UserPlus className="h-4 w-4 mr-2" />
           Admin qo'shish
         </Button>
       </CardHeader>
       <CardContent>
         {loadingAdmins ? (
           <p className="text-center py-8 text-muted-foreground">Yuklanmoqda...</p>
         ) : (
           <Table>
             <TableHeader>
               <TableRow>
                 <TableHead>Admin</TableHead>
                 <TableHead>Tur</TableHead>
                 <TableHead>Ruxsatlar</TableHead>
                 <TableHead>Qo'shilgan</TableHead>
                 <TableHead>Amallar</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {allAdmins?.map((admin: any) => (
                 <TableRow key={admin.id}>
                   <TableCell className="font-medium">
                     {admin.profiles?.full_name || 'Noma\'lum'}
                   </TableCell>
                   <TableCell>
                     {admin.is_super_admin ? (
                     <Badge className="bg-amber-500 text-white">Super Admin</Badge>
                     ) : (
                       <Badge variant="secondary">Admin</Badge>
                     )}
                   </TableCell>
                   <TableCell>
                     <div className="flex flex-wrap gap-1">
                       {Object.entries(permissionLabels).map(([key, label]) => (
                       admin[key] && <Badge key={key} variant="outline" className="text-xs bg-muted">{label}</Badge>
                       ))}
                     </div>
                   </TableCell>
                   <TableCell>{format(new Date(admin.created_at), 'dd.MM.yyyy')}</TableCell>
                   <TableCell>
                     {!admin.is_super_admin && (
                       <div className="flex gap-1">
                         <Button size="sm" variant="outline" onClick={() => openEditDialog(admin)}>
                           <Settings className="h-3 w-3" />
                         </Button>
                         <Button size="sm" variant="destructive" onClick={() => handleRemoveAdmin(admin.user_id)}>
                           <Trash2 className="h-3 w-3" />
                         </Button>
                       </div>
                     )}
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
         )}
 
         {/* Add Admin Dialog */}
         <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Yangi admin qo'shish</DialogTitle>
             </DialogHeader>
             <div className="space-y-4">
               <div>
                 <Label>Foydalanuvchi</Label>
                 <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                   <SelectTrigger>
                     <SelectValue placeholder="Tanlang" />
                   </SelectTrigger>
                   <SelectContent>
                     {nonAdminUsers.map((u: any) => (
                       <SelectItem key={u.user_id} value={u.user_id}>
                         {u.full_name || u.phone || 'Noma\'lum'}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               
               <div className="space-y-3">
                 <Label>Ruxsatlar</Label>
                 {Object.entries(permissionLabels).map(([key, label]) => (
                   <div key={key} className="flex items-center justify-between">
                     <span className="text-sm">{label}</span>
                     <Switch
                       checked={newPerms[key] || false}
                       onCheckedChange={(checked) => setNewPerms(p => ({ ...p, [key]: checked }))}
                     />
                   </div>
                 ))}
               </div>
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowAddDialog(false)}>Bekor</Button>
               <Button onClick={handleAddAdmin} disabled={!selectedUserId || addAdmin.isPending}>
                 Qo'shish
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
 
         {/* Edit Permissions Dialog */}
         <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Ruxsatlarni tahrirlash</DialogTitle>
             </DialogHeader>
             <div className="space-y-3">
               {Object.entries(permissionLabels).map(([key, label]) => (
                 <div key={key} className="flex items-center justify-between">
                   <span className="text-sm">{label}</span>
                   <Switch
                     checked={newPerms[key] || false}
                     onCheckedChange={(checked) => setNewPerms(p => ({ ...p, [key]: checked }))}
                   />
                 </div>
               ))}
             </div>
             <DialogFooter>
               <Button variant="outline" onClick={() => setShowEditDialog(false)}>Bekor</Button>
               <Button onClick={handleUpdatePermissions} disabled={updateAdminPermissions.isPending}>
                 Saqlash
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       </CardContent>
     </Card>
   );
 }