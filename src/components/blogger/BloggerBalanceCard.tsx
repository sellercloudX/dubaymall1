import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wallet, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { differenceInDays, differenceInHours, format, addDays } from 'date-fns';

interface PendingCommission {
  id: string;
  commission_amount: number;
  created_at: string;
  order_id: string;
  status: string;
  orders: {
    delivery_confirmed_at: string | null;
    order_number: string;
  } | null;
}

export function BloggerBalanceCard() {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState<Record<string, string>>({});

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['blogger-balance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('blogger_balances')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: pendingCommissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ['blogger-pending-commissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('commissions')
        .select(`
          id,
          commission_amount,
          created_at,
          order_id,
          status,
          orders (delivery_confirmed_at, order_number)
        `)
        .eq('blogger_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PendingCommission[];
    },
    enabled: !!user,
  });

  // Update countdown every minute
  useEffect(() => {
    const updateCountdowns = () => {
      if (!pendingCommissions) return;
      
      const newCountdowns: Record<string, string> = {};
      pendingCommissions.forEach((commission) => {
        const deliveryConfirmedAt = commission.orders?.delivery_confirmed_at;
        if (deliveryConfirmedAt) {
          const availableAt = addDays(new Date(deliveryConfirmedAt), 10);
          const now = new Date();
          
          if (availableAt > now) {
            const daysLeft = differenceInDays(availableAt, now);
            const hoursLeft = differenceInHours(availableAt, now) % 24;
            newCountdowns[commission.id] = `${daysLeft}k ${hoursLeft}s`;
          } else {
            newCountdowns[commission.id] = 'Tayyor';
          }
        } else {
          newCountdowns[commission.id] = 'Yetkazish kutilmoqda';
        }
      });
      setCountdown(newCountdowns);
    };

    updateCountdowns();
    const interval = setInterval(updateCountdowns, 60000);
    return () => clearInterval(interval);
  }, [pendingCommissions]);

  const totalPending = pendingCommissions?.reduce((sum, c) => sum + c.commission_amount, 0) || 0;
  const availableBalance = balance?.available_balance || 0;
  const totalEarned = balance?.total_earned || 0;

  if (balanceLoading || commissionsLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <Wallet className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Mavjud balans</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold whitespace-nowrap">{availableBalance.toLocaleString()} so'm</p>
            <p className="text-emerald-100 text-sm mt-1">Yechib olish mumkin</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Kutilayotgan</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold whitespace-nowrap">{totalPending.toLocaleString()} so'm</p>
            <p className="text-amber-100 text-sm mt-1">10 kun kutish muddati</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-100 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Jami daromad</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl md:text-3xl font-bold whitespace-nowrap">{totalEarned.toLocaleString()} so'm</p>
            <p className="text-blue-100 text-sm mt-1">Boshidan beri</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Commissions with Countdown */}
      {pendingCommissions && pendingCommissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Kutilayotgan komissiyalar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingCommissions.map((commission) => {
              const deliveryConfirmedAt = commission.orders?.delivery_confirmed_at;
              const availableAt = deliveryConfirmedAt 
                ? addDays(new Date(deliveryConfirmedAt), 10) 
                : null;
              const progress = deliveryConfirmedAt && availableAt
                ? Math.min(100, ((10 - differenceInDays(availableAt, new Date())) / 10) * 100)
                : 0;

              return (
                <div key={commission.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {commission.orders?.order_number || 'Buyurtma'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(commission.created_at), 'dd.MM.yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">
                        +{commission.commission_amount.toLocaleString()} so'm
                      </p>
                      <Badge variant={countdown[commission.id] === 'Tayyor' ? 'default' : 'secondary'}>
                        {countdown[commission.id] || 'Hisoblanmoqda...'}
                      </Badge>
                    </div>
                  </div>
                  
                  {deliveryConfirmedAt && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Yetkazildi: {format(new Date(deliveryConfirmedAt), 'dd.MM')}</span>
                        <span>Tayyor: {availableAt ? format(availableAt, 'dd.MM') : '-'}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                  
                  {!deliveryConfirmedAt && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>Buyurtma yetkazilgandan keyin 10 kun kutiladi</span>
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
