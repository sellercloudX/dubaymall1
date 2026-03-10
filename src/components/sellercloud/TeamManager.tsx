import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Users, UserPlus, Shield, Eye, Package, ShoppingCart,
  DollarSign, Settings, Trash2, Mail, CheckCircle, XCircle,
  Clock, Loader2, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TeamPermissions {
  view_products: boolean;
  view_orders: boolean;
  view_analytics: boolean;
  edit_products: boolean;
  manage_orders: boolean;
  manage_prices: boolean;
  view_financials: boolean;
  manage_settings: boolean;
}

const DEFAULT_PERMISSIONS: TeamPermissions = {
  view_products: true,
  view_orders: true,
  view_analytics: true,
  edit_products: false,
  manage_orders: false,
  manage_prices: false,
  view_financials: false,
  manage_settings: false,
};

const PERMISSION_CONFIG = [
  { key: 'view_products', label: 'Mahsulotlarni ko\'rish', icon: Package, group: 'view' },
  { key: 'view_orders', label: 'Buyurtmalarni ko\'rish', icon: ShoppingCart, group: 'view' },
  { key: 'view_analytics', label: 'Analitikani ko\'rish', icon: BarChart3, group: 'view' },
  { key: 'view_financials', label: 'Moliyani ko\'rish', icon: DollarSign, group: 'view' },
  { key: 'edit_products', label: 'Mahsulotlarni tahrirlash', icon: Package, group: 'edit' },
  { key: 'manage_orders', label: 'Buyurtmalarni boshqarish', icon: ShoppingCart, group: 'edit' },
  { key: 'manage_prices', label: 'Narxlarni boshqarish', icon: DollarSign, group: 'edit' },
  { key: 'manage_settings', label: 'Sozlamalarni boshqarish', icon: Settings, group: 'edit' },
] as const;

const ROLE_PRESETS: Record<string, { label: string; permissions: TeamPermissions }> = {
  viewer: {
    label: 'Ko\'ruvchi',
    permissions: { ...DEFAULT_PERMISSIONS },
  },
  operator: {
    label: 'Operator',
    permissions: { ...DEFAULT_PERMISSIONS, manage_orders: true },
  },
  manager: {
    label: 'Menejer',
    permissions: { ...DEFAULT_PERMISSIONS, edit_products: true, manage_orders: true, manage_prices: true, view_financials: true },
  },
  admin: {
    label: 'Admin',
    permissions: { view_products: true, view_orders: true, view_analytics: true, edit_products: true, manage_orders: true, manage_prices: true, view_financials: true, manage_settings: true },
  },
};

export function TeamManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [invitePermissions, setInvitePermissions] = useState<TeamPermissions>({ ...DEFAULT_PERMISSIONS });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<TeamPermissions>({ ...DEFAULT_PERMISSIONS });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Also check if user is a member of someone else's team
  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-team-memberships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('member_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleInvite = async () => {
    if (!user || !inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      // Look up user by email
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('email', inviteEmail.trim().toLowerCase())
        .limit(1);

      if (!profiles || profiles.length === 0) {
        toast.error('Bu email bilan foydalanuvchi topilmadi. Foydalanuvchi avval platformaga ro\'yxatdan o\'tishi kerak.');
        return;
      }

      const targetUserId = profiles[0].user_id;

      if (targetUserId === user.id) {
        toast.error('O\'zingizni jamoa a\'zosi sifatida qo\'sha olmaysiz');
        return;
      }

      const { error } = await supabase
        .from('team_members')
        .insert({
          owner_user_id: user.id,
          member_user_id: targetUserId,
          role: inviteRole,
          permissions: invitePermissions as any,
          invited_email: inviteEmail.trim().toLowerCase(),
          status: 'pending',
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Bu foydalanuvchi allaqachon jamoangizda');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Taklif yuborildi!');
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('viewer');
      setInvitePermissions({ ...DEFAULT_PERMISSIONS });
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) { toast.error('Xatolik'); return; }
    toast.success('A\'zo olib tashlandi');
    queryClient.invalidateQueries({ queryKey: ['team-members'] });
  };

  const handleAcceptInvite = async (memberId: string) => {
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', memberId);
    if (error) { toast.error('Xatolik'); return; }
    toast.success('Taklif qabul qilindi');
    queryClient.invalidateQueries({ queryKey: ['my-team-memberships'] });
  };

  const handleDeclineInvite = async (memberId: string) => {
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'declined' })
      .eq('id', memberId);
    if (error) { toast.error('Xatolik'); return; }
    toast.info('Taklif rad etildi');
    queryClient.invalidateQueries({ queryKey: ['my-team-memberships'] });
  };

  const handleUpdatePermissions = async () => {
    if (!editMemberId) return;
    const { error } = await supabase
      .from('team_members')
      .update({ permissions: editPermissions as any, updated_at: new Date().toISOString() })
      .eq('id', editMemberId);
    if (error) { toast.error('Xatolik'); return; }
    toast.success('Ruxsatlar yangilandi');
    queryClient.invalidateQueries({ queryKey: ['team-members'] });
    setEditMemberId(null);
  };

  const applyRolePreset = (role: string) => {
    setInviteRole(role);
    setInvitePermissions({ ...ROLE_PRESETS[role].permissions });
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof CheckCircle }> = {
    accepted: { label: 'Faol', variant: 'default', icon: CheckCircle },
    pending: { label: 'Kutilmoqda', variant: 'secondary', icon: Clock },
    declined: { label: 'Rad etilgan', variant: 'destructive', icon: XCircle },
  };

  const pendingInvites = myMemberships.filter(m => m.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Pending invites for current user */}
      {pendingInvites.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Sizga kelgan takliflar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                <div>
                  <p className="text-sm font-medium">Jamoaga taklif</p>
                  <p className="text-xs text-muted-foreground">Rol: {ROLE_PRESETS[inv.role]?.label || inv.role}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAcceptInvite(inv.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />Qabul
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDeclineInvite(inv.id)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Rad
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Jamoa boshqaruvi
          </h2>
          <p className="text-sm text-muted-foreground">Xodimlaringizni qo'shing va ruxsatlarini boshqaring</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> A'zo qo'shish
        </Button>
      </div>

      {/* Team members list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Hali jamoa a'zolari yo'q</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Xodimlaringizni taklif qiling — ular mahsulotlar, buyurtmalar va analitikani ko'rishlari mumkin
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Birinchi a'zoni qo'shish
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {members.map(member => {
            const perms = (member.permissions || {}) as TeamPermissions;
            const statusCfg = statusConfig[member.status] || statusConfig.pending;
            const StatusIcon = statusCfg.icon;
            const permCount = Object.values(perms).filter(Boolean).length;

            return (
              <Card key={member.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.invited_email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            <Shield className="h-2.5 w-2.5 mr-1" />
                            {ROLE_PRESETS[member.role]?.label || member.role}
                          </Badge>
                          <Badge variant={statusCfg.variant} className="text-[10px]">
                            <StatusIcon className="h-2.5 w-2.5 mr-1" />{statusCfg.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{permCount}/8 ruxsat</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditMemberId(member.id);
                        setEditPermissions(perms);
                      }}>
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(member.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jamoa a'zosini taklif qilish</DialogTitle>
            <DialogDescription>Foydalanuvchi platformaga ro'yxatdan o'tgan bo'lishi kerak</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="xodim@example.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div>
              <Label>Rol</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                  <button key={key} onClick={() => applyRolePreset(key)}
                    className={`p-2.5 rounded-lg border text-left transition-colors ${inviteRole === key ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                    <p className="text-sm font-medium">{preset.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {Object.values(preset.permissions).filter(Boolean).length}/8 ruxsat
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Ruxsatlar</Label>
              <div className="space-y-2 mt-1.5">
                {PERMISSION_CONFIG.map(perm => {
                  const Icon = perm.icon;
                  return (
                    <div key={perm.key} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{perm.label}</span>
                      </div>
                      <Switch
                        checked={invitePermissions[perm.key as keyof TeamPermissions]}
                        onCheckedChange={v => setInvitePermissions(p => ({ ...p, [perm.key]: v }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Bekor</Button>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Taklif yuborish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit permissions dialog */}
      <Dialog open={!!editMemberId} onOpenChange={open => !open && setEditMemberId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ruxsatlarni tahrirlash</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {PERMISSION_CONFIG.map(perm => {
              const Icon = perm.icon;
              return (
                <div key={perm.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{perm.label}</span>
                  </div>
                  <Switch
                    checked={editPermissions[perm.key as keyof TeamPermissions]}
                    onCheckedChange={v => setEditPermissions(p => ({ ...p, [perm.key]: v }))}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMemberId(null)}>Bekor</Button>
            <Button onClick={handleUpdatePermissions}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
