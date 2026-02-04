import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerCloudAdmin } from '@/hooks/useSellerCloudSubscription';
import { toast } from 'sonner';
import { 
  Crown, Users, CreditCard, AlertTriangle, CheckCircle2, 
  XCircle, Search, RefreshCw, DollarSign, Receipt, 
  UserCheck, UserX, Ban, Clock
} from 'lucide-react';
import { format } from 'date-fns';

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
    createBilling,
  } = useSellerCloudAdmin();

  const [search, setSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [selectedBilling, setSelectedBilling] = useState<any>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + ' mln so\'m';
    }
    return new Intl.NumberFormat('uz-UZ').format(price) + ' so\'m';
  };

  const handleActivate = async () => {
    if (!selectedSub) return;
    const result = await activateSubscription(selectedSub.id, adminNotes);
    if (result.success) {
      toast.success('Obuna aktivlashtirildi');
      setSelectedSub(null);
      setAdminNotes('');
    } else {
      toast.error(result.error);
    }
  };

  const handleDeactivate = async (subId: string) => {
    const result = await deactivateSubscription(subId);
    if (result.success) {
      toast.success('Obuna o\'chirildi');
    } else {
      toast.error(result.error);
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
    active: subscriptions.filter(s => s.is_active).length,
    trial: subscriptions.filter(s => s.is_trial).length,
    adminOverride: subscriptions.filter(s => s.admin_override).length,
    totalDebt: billings.filter(b => b.status === 'pending' || b.status === 'overdue').reduce((sum, b) => sum + b.balance_due, 0),
    totalPaid: billings.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.total_paid, 0),
  };

  const filteredSubscriptions = subscriptions.filter(s => 
    s.user_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.plan_type?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Yuklanmoqda...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              Jami
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Faol
            </div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Clock className="h-4 w-4" />
              Sinov
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.trial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-purple-600 text-sm">
              <Crown className="h-4 w-4" />
              Admin aktiv
            </div>
            <div className="text-2xl font-bold text-purple-600">{stats.adminOverride}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              Qarzdorlik
            </div>
            <div className="text-xl font-bold text-destructive">{formatPrice(stats.totalDebt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <DollarSign className="h-4 w-4" />
              To'langan
            </div>
            <div className="text-xl font-bold text-green-600">{formatPrice(stats.totalPaid)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                SellerCloudX Boshqaruvi
              </CardTitle>
              <CardDescription>Obunalar va to'lovlarni boshqaring</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Qidirish..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={refetch}>
                <RefreshCw className="h-4 w-4" />
              </Button>
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
                    <TableHead>Holat</TableHead>
                    <TableHead>Boshlanish</TableHead>
                    <TableHead>Amallar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-mono text-xs">{sub.user_id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant={sub.plan_type === 'pro' ? 'default' : 'secondary'}>
                          {sub.plan_type === 'pro' ? 'Pro' : 'Enterprise'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          ${sub.monthly_fee} + {sub.commission_percent}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {sub.is_active ? (
                            <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Faol</Badge>
                          ) : (
                            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Nofaol</Badge>
                          )}
                          {sub.is_trial && (
                            <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Sinov</Badge>
                          )}
                          {sub.admin_override && (
                            <Badge className="bg-purple-500"><Crown className="h-3 w-3 mr-1" />Admin</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(sub.started_at), 'dd.MM.yy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!sub.is_active ? (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setSelectedSub(sub)}>
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Aktivlashtirish
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Obunani aktivlashtirish</DialogTitle>
                                  <DialogDescription>
                                    Bu foydalanuvchini admin tomondan aktivlashtiriladi. Qarzdorlik va to'lovlar talab qilinmaydi.
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Admin izohi (ixtiyoriy)"
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button onClick={handleActivate}>Aktivlashtirish</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => handleDeactivate(sub.id)}
                            >
                              <UserX className="h-3 w-3 mr-1" />
                              O'chirish
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {billings.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell>
                        {format(new Date(bill.billing_period_start), 'MMM yyyy')}
                      </TableCell>
                      <TableCell>{formatPrice(bill.total_sales_volume)}</TableCell>
                      <TableCell>{formatPrice(bill.total_due)}</TableCell>
                      <TableCell className="text-green-600">{formatPrice(bill.total_paid)}</TableCell>
                      <TableCell className={bill.balance_due > 0 ? 'text-destructive font-bold' : ''}>
                        {formatPrice(bill.balance_due)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            bill.status === 'paid' ? 'default' : 
                            bill.status === 'waived' ? 'secondary' : 
                            bill.status === 'overdue' ? 'destructive' : 'outline'
                          }
                        >
                          {bill.status === 'paid' ? 'To\'langan' : 
                           bill.status === 'waived' ? 'Bekor qilingan' :
                           bill.status === 'overdue' ? 'Muddati o\'tgan' : 'Kutilmoqda'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {bill.status !== 'paid' && bill.status !== 'waived' && (
                          <div className="flex gap-1">
                            {/* Mark as Paid Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setSelectedBilling(bill)}>
                                  <DollarSign className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>To'lovni qabul qilish</DialogTitle>
                                  <DialogDescription>
                                    Qarzdorlik: {formatPrice(bill.balance_due)}
                                  </DialogDescription>
                                </DialogHeader>
                                <Input
                                  type="number"
                                  placeholder="Summa"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button onClick={handlePayment}>Qabul qilish</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            {/* Waive Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={() => setSelectedBilling(bill)}>
                                  <Ban className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Qarzdorlikni bekor qilish</DialogTitle>
                                  <DialogDescription>
                                    Summa: {formatPrice(bill.balance_due)}
                                  </DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  placeholder="Bekor qilish sababi"
                                  value={waiveReason}
                                  onChange={(e) => setWaiveReason(e.target.value)}
                                />
                                <DialogFooter>
                                  <Button variant="destructive" onClick={handleWaive}>Bekor qilish</Button>
                                </DialogFooter>
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
    </div>
  );
}