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
       const { data: permsData, error: permsError } = await supabase
         .from('admin_permissions')
         .select('*')
         .order('created_at', { ascending: false });
       
       if (permsError) throw permsError;
       
       const userIds = permsData?.map(p => p.user_id) || [];
       const { data: profilesData } = await supabase
         .from('profiles')
         .select('user_id, full_name, phone')
         .in('user_id', userIds);
       
       const merged = permsData?.map(perm => ({
         ...perm,
         profiles: profilesData?.find(p => p.user_id === perm.user_id) || null,
       }));
       
       return merged;
    },
    enabled: !!permissions?.is_super_admin,
  });

  // Use atomic server-side function for admin management
  const addAdmin = useMutation({
    mutationFn: async ({ userId, perms }: { userId: string; perms: Partial<AdminPermissions> }) => {
      const { data, error } = await supabase.rpc('manage_admin', {
        p_action: 'add',
        p_target_user_id: userId,
        p_permissions: perms as any,
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.rpc('manage_admin', {
        p_action: 'update',
        p_target_user_id: userId,
        p_permissions: perms as any,
      });
      if (error) throw error;
      return data;
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
      const { data, error } = await supabase.rpc('manage_admin', {
        p_action: 'remove',
        p_target_user_id: userId,
        p_permissions: {} as any,
      });
      if (error) throw error;
      return data;
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
