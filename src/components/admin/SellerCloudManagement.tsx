import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerCloudAdmin } from '@/hooks/useSellerCloudSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Crown, Users, CreditCard, AlertTriangle, CheckCircle2, 
  XCircle, Search, RefreshCw, DollarSign, Receipt, 
  UserCheck, UserX, Ban, Clock, Edit, Calendar, Gift
} from 'lucide-react';
import { format, addDays, addMonths } from 'date-fns';

const USD_TO_UZS = 12800;

export function SellerCloudManagement() {
  const { 
    subscriptions, 
    billings, 
    isLoading, 
    refetch,
    activateSubscription,
    deactivateSubscription,
    waiveBilling,
    markBillingPaid,
  } = useSellerCloudAdmin();

  const [search, setSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [selectedBilling, setSelectedBilling] = useState<any>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Tariff editing state
  const [editingSub, setEditingSub] = useState<any>(null);
  const [editMonthlyFee, setEditMonthlyFee] = useState('');
  const [editCommission, setEditCommission] = useState('');
  const [editPlanType, setEditPlanType] = useState<'pro' | 'enterprise'>('pro');

  // Activation state  
  const [activatingSub, setActivatingSub] = useState<any>(null);
  const [activationDuration, setActivationDuration] = useState('30'); // days
  const [activationDurationType, setActivationDurationType] = useState<'days' | 'months'>('days');
  const [freeAccess, setFreeAccess] = useState(false);

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const handleEditTariff = async () => {
    if (!editingSub) return;
    const fee = parseFloat(editMonthlyFee);
    const comm = parseFloat(editCommission);
    if (isNaN(fee) || isNaN(comm) || fee < 0 || comm < 0 || comm > 100) {
      toast.error('Noto\'g\'ri qiymatlar');
      return;
    }

    const { error } = await supabase
      .from('sellercloud_subscriptions')
      .update({
        monthly_fee: fee,
        commission_percent: comm,
        plan_type: editPlanType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingSub.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Tarif yangilandi');
      setEditingSub(null);
      refetch();
    }
  };

  const handleActivate = async () => {
    if (!activatingSub) return;
    const duration = parseInt(activationDuration);
    if (isNaN(duration) || duration <= 0) {
      toast.error('Noto\'g\'ri muddat');
      return;
    }

    const activatedUntil = activationDurationType === 'months' 
      ? addMonths(new Date(), duration)
      : addDays(new Date(), duration);

    const { error } = await supabase
      .from('sellercloud_subscriptions')
      .update({
        is_active: true,
        admin_override: true,
        free_access: freeAccess,
        activated_until: activatedUntil.toISOString(),
        activated_by: 'admin',
        contract_duration_months: activationDurationType === 'months' ? duration : null,
        admin_notes: adminNotes || `Admin aktivlashtirildi: ${duration} ${activationDurationType === 'months' ? 'oy' : 'kun'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activatingSub.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Aktivlashtirildi: ${format(activatedUntil, 'dd.MM.yyyy')} gacha`);
      setActivatingSub(null);
      setAdminNotes('');
      setFreeAccess(false);
      refetch();
    }
  };

  const handleDeactivate = async (subId: string) => {
    const { error } = await supabase
      .from('sellercloud_subscriptions')
      .update({
        is_active: false,
        admin_override: false,
        free_access: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Obuna o\'chirildi');
      refetch();
    }
  };

  const handleWaive = async () => {
    if (!selectedBilling || !waiveReason) return;
    const result = await waiveBilling(selectedBilling.id, waiveReason);
    if (result.success) {
      toast.success('Qarzdorlik bekor qilindi');
      setSelectedBilling(null);
      setWaiveReason('');
    } else {
      toast.error(result.error);
    }
  };

  const handlePayment = async () => {
    if (!selectedBilling || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Noto\'g\'ri summa');
      return;
    }
    const result = await markBillingPaid(selectedBilling.id, amount);
    if (result.success) {
      toast.success('To\'lov qabul qilindi');
      setSelectedBilling(null);
      setPaymentAmount('');
    } else {
      toast.error(result.error);
    }
  };

  // Statistics
  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter((s: any) => s.is_active).length,
    freeAccess: subscriptions.filter((s: any) => s.free_access).length,
    adminOverride: subscriptions.filter((s: any) => s.admin_override).length,
    totalDebt: billings.filter((b: any) => b.status === 'pending' || b.status === 'overdue').reduce((sum: number, b: any) => sum + b.balance_due, 0),
    totalPaid: billings.filter((b: any) => b.status === 'paid').reduce((sum: number, b: any) => sum + b.total_paid, 0),
  };

  // Fetch profiles for display names
  const [profilesMap, setProfilesMap] = useState<any>({});
  
  const fetchProfiles = async () => {
    const userIds = subscriptions.map(s => s.user_id).filter(Boolean);
    if (userIds.length === 0) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', userIds);
    
    const map: any = {};
    data?.forEach(p => {
      map[p.user_id] = p.full_name;
    });
    setProfilesMap(map);
  };

  // Fetch profiles when subscriptions change
  if (Object.keys(profilesMap).length === 0 && subscriptions.length > 0) {
    fetchProfiles();
  }

  const filteredSubscriptions = subscriptions.filter((s: any) => {
    const userName = profilesMap[s.user_id] || s.user_id;
    return userName?.toLowerCase().includes(search.toLowerCase()) ||
           s.plan_type?.toLowerCase().includes(search.toLowerCase());
  });

  const isExpired = (sub: any) => sub.activated_until && new Date(sub.activated_until) < new Date();
  const daysLeft = (sub: any) => {
    if (!sub.activated_until) return null;
    const diff = Math.ceil((new Date(sub.activated_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Jami</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-600 text-sm"><CheckCircle2 className="h-4 w-4" />Faol</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-blue-600 text-sm"><Gift className="h-4 w-4" />Bepul</div>
          <div className="text-2xl font-bold text-blue-600">{stats.freeAccess}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-purple-600 text-sm"><Crown className="h-4 w-4" />Admin aktiv</div>
          <div className="text-2xl font-bold text-purple-600">{stats.adminOverride}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-destructive text-sm"><AlertTriangle className="h-4 w-4" />Qarzdorlik</div>
          <div className="text-xl font-bold text-destructive">{formatPrice(stats.totalDebt)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-600 text-sm"><DollarSign className="h-4 w-4" />To'langan</div>
          <div className="text-xl font-bold text-green-600">{formatPrice(stats.totalPaid)}</div>
        </CardContent></Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" />SellerCloudX Boshqaruvi</CardTitle>
              <CardDescription>Tariflar, aktivatsiya va to'lovlarni boshqaring</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-[200px]" />
              </div>
              <Button variant="outline" size="icon" onClick={refetch}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="subscriptions">
            <TabsList>
              <TabsTrigger value="subscriptions">Obunalar ({subscriptions.length})</TabsTrigger>
              <TabsTrigger value="billing">To'lovlar ({billings.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="subscriptions" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Foydalanuvchi</TableHead>
                    <TableHead>Tarif</TableHead>
                    <TableHead>To'lov</TableHead>
                    <TableHead>Muddat</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub: any) => {
                    const days = daysLeft(sub);
                    const expired = isExpired(sub);
                    return (
                      <TableRow key={sub.id}>
                         <TableCell className="font-medium">{profilesMap[sub.user_id] || sub.user_id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Badge variant={sub.plan_type === 'pro' ? 'default' : 'secondary'}>
                            {sub.plan_type === 'pro' ? 'Pro' : 'Individual'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">${sub.monthly_fee}/oy</div>
                          <div className="text-xs text-muted-foreground">+ {sub.commission_percent}% savdo</div>
                        </TableCell>
                        <TableCell>
                          {sub.activated_until ? (
                            <div className="text-xs">
                              <div>{format(new Date(sub.activated_until), 'dd.MM.yyyy')}</div>
                              {expired ? (
                                <Badge variant="destructive" className="text-[10px] px-1">Muddati o'tgan</Badge>
                              ) : days !== null && days <= 7 ? (
                                <Badge variant="outline" className="text-[10px] px-1 text-amber-600">{days} kun qoldi</Badge>
                              ) : (
                                <span className="text-muted-foreground">{days} kun</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Belgilanmagan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {sub.is_active ? (
                              <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Faol</Badge>
                            ) : (
                              <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Nofaol</Badge>
                            )}
                            {sub.free_access && (
                              <Badge variant="outline" className="text-blue-600"><Gift className="h-3 w-3 mr-1" />Bepul</Badge>
                            )}
                            {sub.admin_override && (
                              <Badge className="bg-purple-500"><Crown className="h-3 w-3 mr-1" />Admin</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {/* Edit Tariff */}
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingSub(sub);
                              setEditMonthlyFee(String(sub.monthly_fee));
                              setEditCommission(String(sub.commission_percent));
                              setEditPlanType(sub.plan_type);
                            }}>
                              <Edit className="h-3 w-3" />
                            </Button>

                            {/* Activate */}
                            {!sub.is_active || expired ? (
                              <Button size="sm" variant="outline" className="text-green-600" onClick={() => {
                                setActivatingSub(sub);
                                setActivationDuration('30');
                                setActivationDurationType('days');
                                setFreeAccess(false);
                                setAdminNotes('');
                              }}>
                                <UserCheck className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="destructive" onClick={() => handleDeactivate(sub.id)}>
                                <UserX className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredSubscriptions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Obunalar topilmadi</p>
              )}
            </TabsContent>

            <TabsContent value="billing" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Davr</TableHead>
                    <TableHead>Savdo hajmi</TableHead>
                    <TableHead>To'lanishi kerak</TableHead>
                    <TableHead>To'langan</TableHead>
                    <TableHead>Qarzdorlik</TableHead>
                    <TableHead>Holat</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billings.map((bill: any) => (
                    <TableRow key={bill.id}>
                      <TableCell>{format(new Date(bill.billing_period_start), 'MMM yyyy')}</TableCell>
                      <TableCell>{formatPrice(bill.total_sales_volume)}</TableCell>
                      <TableCell>{formatPrice(bill.total_due)}</TableCell>
                      <TableCell className="text-green-600">{formatPrice(bill.total_paid)}</TableCell>
                      <TableCell className={bill.balance_due > 0 ? 'text-destructive font-bold' : ''}>
                        {formatPrice(bill.balance_due)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          bill.status === 'paid' ? 'default' : 
                          bill.status === 'waived' ? 'secondary' : 
                          bill.status === 'overdue' ? 'destructive' : 'outline'
                        }>
                          {bill.status === 'paid' ? 'To\'langan' : 
                           bill.status === 'waived' ? 'Bekor qilingan' :
                           bill.status === 'overdue' ? 'Muddati o\'tgan' : 'Kutilmoqda'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {bill.status !== 'paid' && bill.status !== 'waived' && (
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => { setSelectedBilling(bill); setPaymentAmount(''); }}>
                                  <DollarSign className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>To'lovni qabul qilish</DialogTitle>
                                  <DialogDescription>Qarzdorlik: {formatPrice(bill.balance_due)}</DialogDescription>
                                </DialogHeader>
                                <Input type="number" placeholder="Summa" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                                <DialogFooter><Button onClick={handlePayment}>Qabul qilish</Button></DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={() => { setSelectedBilling(bill); setWaiveReason(''); }}>
                                  <Ban className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Qarzdorlikni bekor qilish</DialogTitle>
                                  <DialogDescription>Summa: {formatPrice(bill.balance_due)}</DialogDescription>
                                </DialogHeader>
                                <Textarea placeholder="Bekor qilish sababi" value={waiveReason} onChange={(e) => setWaiveReason(e.target.value)} />
                                <DialogFooter><Button variant="destructive" onClick={handleWaive}>Bekor qilish</Button></DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {billings.length === 0 && (
                <p className="text-center text-muted-foreground py-8">To'lovlar topilmadi</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Tariff Dialog */}
      <Dialog open={!!editingSub} onOpenChange={(open) => !open && setEditingSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit className="h-5 w-5" />Tarifni tahrirlash</DialogTitle>
            <DialogDescription>Hamkorning oylik to'lov va komissiya foizini o'zgartiring</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tarif turi</Label>
              <Select value={editPlanType} onValueChange={(v: any) => setEditPlanType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro ($499 standart)</SelectItem>
                  <SelectItem value="enterprise">Individual (kelishuv)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Oylik to'lov (USD)</Label>
              <Input type="number" value={editMonthlyFee} onChange={(e) => setEditMonthlyFee(e.target.value)} placeholder="499" />
              {editMonthlyFee && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ {formatPrice(parseFloat(editMonthlyFee || '0') * USD_TO_UZS)}
                </p>
              )}
            </div>
            <div>
              <Label>Savdo komissiyasi (%)</Label>
              <Input type="number" value={editCommission} onChange={(e) => setEditCommission(e.target.value)} placeholder="4" step="0.5" min="0" max="100" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSub(null)}>Bekor qilish</Button>
            <Button onClick={handleEditTariff}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activation Dialog */}
      <Dialog open={!!activatingSub} onOpenChange={(open) => !open && setActivatingSub(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-green-600" />Aktivlashtirish</DialogTitle>
            <DialogDescription>
              Hamkorni ma'lum muddatga aktivlashtiring. Muddat tugaganda avtomatik bloklanadi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activatingSub && (
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <p>Tarif: <strong>{activatingSub.plan_type === 'pro' ? 'Pro' : 'Individual'}</strong></p>
                <p>To'lov: <strong>${activatingSub.monthly_fee}/oy + {activatingSub.commission_percent}%</strong></p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Muddat</Label>
                <Input type="number" value={activationDuration} onChange={(e) => setActivationDuration(e.target.value)} min="1" />
              </div>
              <div>
                <Label>Birlik</Label>
                <Select value={activationDurationType} onValueChange={(v: any) => setActivationDurationType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Kun</SelectItem>
                    <SelectItem value="months">Oy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {activationDuration && (
              <p className="text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 inline mr-1" />
                {format(
                  activationDurationType === 'months' 
                    ? addMonths(new Date(), parseInt(activationDuration) || 0)
                    : addDays(new Date(), parseInt(activationDuration) || 0),
                  'dd.MM.yyyy HH:mm'
                )} gacha faol bo'ladi
              </p>
            )}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Switch checked={freeAccess} onCheckedChange={setFreeAccess} />
              <div>
                <Label className="text-sm font-medium">Bepul foydalanish</Label>
                <p className="text-xs text-muted-foreground">To'lovsiz ishlash imkoniyati</p>
              </div>
            </div>
            <div>
              <Label>Admin izohi</Label>
              <Textarea placeholder="Masalan: 3 kunga sinov, yoki kelishuv asosida..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivatingSub(null)}>Bekor qilish</Button>
            <Button onClick={handleActivate} className="bg-green-600 hover:bg-green-700">Aktivlashtirish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
