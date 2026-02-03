import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Wallet, Clock, CheckCircle, XCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface WithdrawalSectionProps {
  balance: number;
}

export default function WithdrawalSection({ balance }: WithdrawalSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [cardNumber, setCardNumber] = useState('');

  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['withdrawals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('blogger_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new Error('Noto\'g\'ri summa');
      }
      if (numAmount > balance) {
        throw new Error('Yetarli mablag\' yo\'q');
      }
      if (numAmount < 50000) {
        throw new Error('Minimal summa 50,000 so\'m');
      }

      const { error } = await supabase
        .from('withdrawal_requests')
        .insert({
          blogger_id: user.id,
          amount: numAmount,
          payment_method: paymentMethod,
          payment_details: { card_number: cardNumber },
        });

      if (error) throw error;

      // Update balance
      await supabase
        .from('blogger_balances')
        .update({
          available_balance: balance - numAmount,
        })
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawals'] });
      queryClient.invalidateQueries({ queryKey: ['blogger-stats'] });
      toast({
        title: 'So\'rov yuborildi',
        description: 'Yechib olish so\'rovi ko\'rib chiqilmoqda',
      });
      setOpen(false);
      setAmount('');
      setCardNumber('');
      setPaymentMethod('');
    },
    onError: (error) => {
      toast({
        title: 'Xatolik',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Kutilmoqda
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-emerald-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            To'langan
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Rad etilgan
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Mavjud balans</p>
              <p className="text-3xl font-bold">{balance.toLocaleString()} so'm</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  className="bg-white text-emerald-600 hover:bg-emerald-50"
                  disabled={balance < 50000}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Yechib olish
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pul yechib olish</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Summa (so'm)</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Minimal: 50,000 so'm. Mavjud: {balance.toLocaleString()} so'm
                    </p>
                  </div>
                  <div>
                    <Label>To'lov usuli</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uzcard">UzCard</SelectItem>
                        <SelectItem value="humo">Humo</SelectItem>
                        <SelectItem value="payme">Payme</SelectItem>
                        <SelectItem value="click">Click</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Karta raqami</Label>
                    <Input
                      placeholder="8600 1234 5678 9012"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createWithdrawalMutation.mutate()}
                    disabled={!amount || !paymentMethod || !cardNumber || createWithdrawalMutation.isPending}
                  >
                    {createWithdrawalMutation.isPending ? 'Yuborilmoqda...' : 'So\'rov yuborish'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Yechib olish tarixi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">{t.loading}</p>
          ) : !withdrawals?.length ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                Hali pul yechib olish so'rovlari yo'q
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sana</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead>To'lov usuli</TableHead>
                    <TableHead>Holat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(withdrawal.created_at), 'dd.MM.yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {withdrawal.amount.toLocaleString()} so'm
                      </TableCell>
                      <TableCell className="capitalize">
                        {withdrawal.payment_method}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(withdrawal.status || 'pending')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
