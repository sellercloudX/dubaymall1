import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSellerBalance } from '@/hooks/useSellerBalance';
import { 
  Wallet, TrendingUp, Clock, ArrowDownCircle, Banknote, CreditCard, Loader2,
  Receipt, DollarSign, PiggyBank, AlertCircle, CheckCircle2, TrendingDown,
  CalendarDays, Package, Percent, Building2
} from 'lucide-react';
import { format } from 'date-fns';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
};

const payoutStatusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', label: 'Kutilmoqda', icon: <Clock className="h-3 w-3" /> },
  ready: { color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', label: 'Tayyor', icon: <CheckCircle2 className="h-3 w-3" /> },
  paid: { color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', label: "To'langan", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const withdrawalStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-amber-500/15 text-amber-600 border-amber-500/30', label: 'Ko\'rib chiqilmoqda' },
  approved: { color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', label: 'Tasdiqlangan' },
  completed: { color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', label: 'Bajarildi' },
  rejected: { color: 'bg-red-500/15 text-red-600 border-red-500/30', label: 'Rad etildi' },
};

export function SellerBalanceCard() {
  const { balance, financials, withdrawals, isLoading, createWithdrawal } = useSellerBalance();
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleWithdraw = async () => {
    if (!withdrawAmount || !paymentMethod || !cardNumber) return;

    await createWithdrawal.mutateAsync({
      amount: parseFloat(withdrawAmount),
      payment_method: paymentMethod,
      payment_details: { card_number: cardNumber },
    });

    setWithdrawAmount('');
    setPaymentMethod('');
    setCardNumber('');
    setDialogOpen(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const availableBalance = balance?.available_balance || 0;
  const pendingBalance = balance?.pending_balance || 0;
  const totalEarned = balance?.total_earned || 0;
  const totalWithdrawn = balance?.total_withdrawn || 0;

  // Calculate totals from financials
  const totalSales = financials?.reduce((sum: number, f: any) => sum + (f.order_total || 0), 0) || 0;
  const totalCommissions = financials?.reduce((sum: number, f: any) => sum + (f.platform_commission_amount || 0), 0) || 0;
  const totalBloggerCommissions = financials?.reduce((sum: number, f: any) => sum + (f.blogger_commission_amount || 0), 0) || 0;
  const totalProfit = financials?.reduce((sum: number, f: any) => sum + (f.seller_profit || f.seller_net_amount || 0), 0) || 0;

  // Filter ready payouts
  const readyPayouts = financials?.filter((f: any) => f.payout_status === 'ready') || [];
  const pendingPayouts = financials?.filter((f: any) => f.payout_status === 'pending') || [];

  return (
    <div className="space-y-6">
      {/* Main Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="col-span-2 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-primary/80">
              <Wallet className="h-4 w-4" />
              Mavjud balans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold text-primary">{formatPrice(availableBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Hozir yechib olish mumkin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5" />
              Kutilmoqda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold text-amber-600">{formatPrice(pendingBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">7 kun kutish</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5" />
              Jami daromad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xl md:text-2xl font-bold text-emerald-600">{formatPrice(totalEarned)}</p>
            <p className="text-xs text-muted-foreground mt-1">Barcha vaqt</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Moliyaviy ko'rsatkichlar
          </CardTitle>
          <CardDescription>Barcha savdolar bo'yicha xarajatlar va daromadlar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="p-3 md:p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Jami savdo</span>
              </div>
              <p className="text-lg md:text-xl font-bold">{formatPrice(totalSales)}</p>
            </div>
            
            <div className="p-3 md:p-4 bg-red-500/5 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <Building2 className="h-4 w-4" />
                <span className="text-xs">Platform komissiya</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-red-600">-{formatPrice(totalCommissions)}</p>
              <p className="text-xs text-muted-foreground">5% har bir sotuvdan</p>
            </div>

            <div className="p-3 md:p-4 bg-orange-500/5 rounded-lg border border-orange-500/20">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-xs">Blogger ulushi</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-orange-600">-{formatPrice(totalBloggerCommissions)}</p>
              <p className="text-xs text-muted-foreground">Affiliate sotuvlar</p>
            </div>

            <div className="p-3 md:p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <PiggyBank className="h-4 w-4" />
                <span className="text-xs">Sof foyda</span>
              </div>
              <p className="text-lg md:text-xl font-bold text-emerald-600">{formatPrice(totalProfit)}</p>
              <p className="text-xs text-muted-foreground">Barcha xarajatlardan keyin</p>
            </div>
          </div>

          {/* Profit margin indicator */}
          {totalSales > 0 && (
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Foyda marjasi</span>
                <span className="font-bold text-primary">
                  {((totalProfit / totalSales) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, (totalProfit / totalSales) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="flex-1 sm:flex-none" disabled={availableBalance <= 0}>
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Pul yechib olish
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Pul yechib olish</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">Mavjud balans</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(availableBalance)}</p>
              </div>

              <div className="space-y-2">
                <Label>Summa</Label>
                <Input
                  type="number"
                  placeholder="Summa kiriting"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  max={availableBalance}
                />
              </div>

              <div className="space-y-2">
                <Label>To'lov usuli</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uzcard">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Uzcard
                      </div>
                    </SelectItem>
                    <SelectItem value="humo">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Humo
                      </div>
                    </SelectItem>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Naqd
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod && paymentMethod !== 'cash' && (
                <div className="space-y-2">
                  <Label>Karta raqami</Label>
                  <Input
                    placeholder="8600 **** **** ****"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleWithdraw}
                disabled={
                  !withdrawAmount || 
                  parseFloat(withdrawAmount) <= 0 || 
                  parseFloat(withdrawAmount) > availableBalance ||
                  !paymentMethod ||
                  (paymentMethod !== 'cash' && !cardNumber) ||
                  createWithdrawal.isPending
                }
              >
                {createWithdrawal.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowDownCircle className="h-4 w-4 mr-2" />
                )}
                So'rov yuborish
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {totalWithdrawn > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Jami yechildi:</span>
            <span className="font-medium">{formatPrice(totalWithdrawn)}</span>
          </div>
        )}
      </div>

      {/* Tabs for Transactions */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <TabsList className="inline-flex">
            <TabsTrigger value="transactions" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Tranzaksiyalar</span>
              <span className="sm:hidden">Tranzak.</span>
            </TabsTrigger>
            <TabsTrigger value="ready" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Tayyor to'lovlar</span>
              <span className="sm:hidden">Tayyor</span>
              {readyPayouts.length > 0 && (
                <Badge variant="secondary" className="ml-1">{readyPayouts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Kutilmoqda</span>
              <span className="sm:hidden">Kutish</span>
              {pendingPayouts.length > 0 && (
                <Badge variant="outline" className="ml-1">{pendingPayouts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Yechish tarixi</span>
              <span className="sm:hidden">Yechish</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <TabsContent value="transactions">
          {financials && financials.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">So'nggi tranzaksiyalar</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Buyurtma</TableHead>
                        <TableHead className="min-w-[100px]">Summa</TableHead>
                        <TableHead className="min-w-[90px]">Komissiya</TableHead>
                        <TableHead className="min-w-[100px]">Sof foyda</TableHead>
                        <TableHead className="min-w-[100px]">Holat</TableHead>
                        <TableHead className="min-w-[90px]">Sana</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financials.slice(0, 15).map((fin: any) => (
                        <TableRow key={fin.id}>
                          <TableCell className="font-mono text-xs">
                            {fin.orders?.order_number?.slice(-8) || '-'}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            {formatPrice(fin.order_total)}
                          </TableCell>
                          <TableCell className="text-red-600 text-sm">
                            -{formatPrice(fin.platform_commission_amount)}
                          </TableCell>
                          <TableCell className="font-medium text-emerald-600 text-sm">
                            {formatPrice(fin.seller_profit || fin.seller_net_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${payoutStatusConfig[fin.payout_status]?.color || ''}`}
                            >
                              <span className="mr-1">{payoutStatusConfig[fin.payout_status]?.icon}</span>
                              {payoutStatusConfig[fin.payout_status]?.label || fin.payout_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(fin.created_at), 'dd.MM.yy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Hali tranzaksiyalar yo'q</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ready">
          {readyPayouts.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Yechishga tayyor to'lovlar
                </CardTitle>
                <CardDescription>
                  Bu mablag'lar allaqachon mavjud balansga qo'shilgan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {readyPayouts.map((fin: any) => (
                    <div key={fin.id} className="flex items-center justify-between p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="font-medium text-sm">{fin.orders?.order_number || 'Buyurtma'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(fin.created_at), 'dd.MM.yyyy')}
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-emerald-600">{formatPrice(fin.seller_profit || fin.seller_net_amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Tayyor to'lovlar yo'q</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending">
          {pendingPayouts.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Kutilayotgan to'lovlar
                </CardTitle>
                <CardDescription>
                  Buyurtma yetkazib berilgandan 7 kun o'tgach balansga qo'shiladi
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingPayouts.map((fin: any) => {
                    const availableDate = fin.payout_available_at 
                      ? new Date(fin.payout_available_at) 
                      : new Date(new Date(fin.created_at).getTime() + 7 * 24 * 60 * 60 * 1000);
                    const daysLeft = Math.ceil((availableDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={fin.id} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-amber-600" />
                          <div>
                            <p className="font-medium text-sm">{fin.orders?.order_number || 'Buyurtma'}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {daysLeft > 0 ? `${daysLeft} kun qoldi` : 'Tez orada'}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-amber-600">{formatPrice(fin.seller_profit || fin.seller_net_amount)}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Kutilayotgan to'lovlar yo'q</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="withdrawals">
          {withdrawals && withdrawals.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pul yechish tarixi</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Summa</TableHead>
                        <TableHead>Usul</TableHead>
                        <TableHead>Holat</TableHead>
                        <TableHead>Sana</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withdrawals.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{formatPrice(w.amount)}</TableCell>
                          <TableCell className="capitalize">{w.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={withdrawalStatusConfig[w.status]?.color}>
                              {withdrawalStatusConfig[w.status]?.label || w.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(w.created_at), 'dd.MM.yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ArrowDownCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Pul yechish tarixi yo'q</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Info Alert */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Pul oqimi haqida</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• Buyurtma yetkazib berilgandan so'ng 7 kun kutish muddati</li>
                <li>• Platform komissiyasi: 5% (har bir sotuvdan)</li>
                <li>• Blogger ulushi: agar affiliate orqali sotilgan bo'lsa</li>
                <li>• Minimal yechish summasi: 50,000 so'm</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
