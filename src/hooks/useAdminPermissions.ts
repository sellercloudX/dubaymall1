 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { toast } from 'sonner';
 
 export interface AdminPermissions {
   id: string;
   user_id: string;
   granted_by: string | null;
   can_manage_users: boolean;
   can_manage_products: boolean;
   can_manage_orders: boolean;
   can_manage_shops: boolean;
   can_manage_activations: boolean;
   can_manage_finances: boolean;
   can_manage_content: boolean;
   can_add_admins: boolean;
   is_super_admin: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export function useAdminPermissions() {
   const { user } = useAuth();
   const queryClient = useQueryClient();
 
   const { data: permissions, isLoading } = useQuery({
     queryKey: ['admin-permissions', user?.id],
     queryFn: async () => {
       if (!user) return null;
       const { data, error } = await supabase
         .from('admin_permissions')
         .select('*')
         .eq('user_id', user.id)
         .maybeSingle();
       
       if (error && error.code !== 'PGRST116') throw error;
       return data as AdminPermissions | null;
     },
     enabled: !!user,
   });
 
   const { data: allAdmins, isLoading: loadingAdmins } = useQuery({
     queryKey: ['all-admin-permissions'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('admin_permissions')
         .select(`
           *,
           profiles:user_id(full_name, phone)
         `)
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       return data;
     },
     enabled: !!permissions?.is_super_admin,
   });
 
   const addAdmin = useMutation({
     mutationFn: async ({ userId, perms }: { userId: string; perms: Partial<AdminPermissions> }) => {
       // First add admin role
       const { error: roleError } = await supabase
         .from('user_roles')
         .insert({ user_id: userId, role: 'admin' })
         .select()
         .single();
       
       if (roleError && !roleError.message.includes('duplicate')) throw roleError;
 
       // Then add permissions
       const { error } = await supabase
         .from('admin_permissions')
         .insert({
           user_id: userId,
           granted_by: user?.id,
           ...perms,
         });
       
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success("Admin qo'shildi");
       queryClient.invalidateQueries({ queryKey: ['all-admin-permissions'] });
       queryClient.invalidateQueries({ queryKey: ['admin-users'] });
     },
     onError: (err: any) => {
       toast.error("Xatolik: " + err.message);
     },
   });
 
   const updateAdminPermissions = useMutation({
     mutationFn: async ({ userId, perms }: { userId: string; perms: Partial<AdminPermissions> }) => {
       const { error } = await supabase
         .from('admin_permissions')
         .update(perms)
         .eq('user_id', userId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       toast.success("Ruxsatlar yangilandi");
       queryClient.invalidateQueries({ queryKey: ['all-admin-permissions'] });
     },
     onError: (err: any) => {
       toast.error("Xatolik: " + err.message);
     },
   });
 
   const removeAdmin = useMutation({
     mutationFn: async (userId: string) => {
       // Remove permissions
       await supabase.from('admin_permissions').delete().eq('user_id', userId);
       // Remove admin role
       await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
     },
     onSuccess: () => {
       toast.success("Admin olib tashlandi");
       queryClient.invalidateQueries({ queryKey: ['all-admin-permissions'] });
       queryClient.invalidateQueries({ queryKey: ['admin-users'] });
     },
     onError: (err: any) => {
       toast.error("Xatolik: " + err.message);
     },
   });
 
   // Helper to check specific permission
   const hasPermission = (perm: keyof AdminPermissions): boolean => {
     if (!permissions) return false;
     if (permissions.is_super_admin) return true;
     return !!permissions[perm];
   };
 
   return {
     permissions,
     isLoading,
     isSuperAdmin: permissions?.is_super_admin || false,
     hasPermission,
     allAdmins,
     loadingAdmins,
     addAdmin,
     updateAdminPermissions,
     removeAdmin,
   };
 }