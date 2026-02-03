import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSellerBalance } from '@/hooks/useSellerBalance';
import { Wallet, TrendingUp, Clock, ArrowDownCircle, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const formatPrice = (price: number) => {
  return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
};

const payoutStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500', label: 'Kutilmoqda' },
  ready: { color: 'bg-blue-500', label: 'Tayyor' },
  paid: { color: 'bg-green-500', label: "To'langan" },
};

const withdrawalStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'bg-yellow-500', label: 'Ko\'rib chiqilmoqda' },
  approved: { color: 'bg-blue-500', label: 'Tasdiqlangan' },
  completed: { color: 'bg-green-500', label: 'Bajarildi' },
  rejected: { color: 'bg-red-500', label: 'Rad etildi' },
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

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Mavjud balans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatPrice(availableBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">Yechib olish mumkin</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Kutilmoqda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{formatPrice(pendingBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">7 kun kutish</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Jami daromad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{formatPrice(totalEarned)}</p>
            <p className="text-xs text-muted-foreground mt-1">Barcha vaqt uchun</p>
          </CardContent>
        </Card>
      </div>

      {/* Withdraw Button */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full md:w-auto" disabled={availableBalance <= 0}>
            <ArrowDownCircle className="h-4 w-4 mr-2" />
            Pul yechib olish
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pul yechib olish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 bg-muted rounded-lg">
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

      {/* Recent Financials */}
      {financials && financials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">So'nggi tranzaksiyalar</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buyurtma</TableHead>
                  <TableHead>Summa</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Sof daromad</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead>Sana</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financials.slice(0, 10).map((fin: any) => (
                  <TableRow key={fin.id}>
                    <TableCell className="font-mono text-sm">
                      {fin.orders?.order_number || '-'}
                    </TableCell>
                    <TableCell>{formatPrice(fin.order_total)}</TableCell>
                    <TableCell className="text-red-600">
                      -{formatPrice(fin.platform_commission_amount)}
                    </TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatPrice(fin.seller_profit || fin.seller_net_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={payoutStatusConfig[fin.payout_status]?.color}>
                        {payoutStatusConfig[fin.payout_status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(fin.created_at), 'dd.MM.yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal History */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pul yechish tarixi</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <Badge className={withdrawalStatusConfig[w.status]?.color}>
                        {withdrawalStatusConfig[w.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(w.created_at), 'dd.MM.yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
