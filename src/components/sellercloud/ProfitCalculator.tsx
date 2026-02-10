import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingUp, TrendingDown, DollarSign, Percent, Truck } from 'lucide-react';

interface ProfitCalculatorProps {
  commissionPercent?: number;
}

export function ProfitCalculator({ commissionPercent = 4 }: ProfitCalculatorProps) {
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [logistics, setLogistics] = useState(4000);

  const yandexCommission = sellingPrice * 0.20;
  const tax = sellingPrice * 0.04;
  const platformFee = sellingPrice * (commissionPercent / 100);
  const totalExpenses = costPrice + yandexCommission + tax + platformFee + logistics;
  const netProfit = sellingPrice - totalExpenses;
  const profitMargin = sellingPrice > 0 ? (netProfit / sellingPrice) * 100 : 0;
  const roi = costPrice > 0 ? (netProfit / costPrice) * 100 : 0;

  const formatPrice = (p: number) => new Intl.NumberFormat('uz-UZ').format(Math.round(p));
  const isProfit = netProfit > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="h-5 w-5 text-primary" />
            Foyda kalkulyatori
          </CardTitle>
          <CardDescription className="text-xs">Sotishdan oldin foydani hisoblang</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Sotish narxi (so'm)</label>
              <Input
                type="number"
                value={sellingPrice || ''}
                onChange={e => setSellingPrice(Number(e.target.value))}
                placeholder="150 000"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tannarx (so'm)</label>
              <Input
                type="number"
                value={costPrice || ''}
                onChange={e => setCostPrice(Number(e.target.value))}
                placeholder="80 000"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Logistika (so'm)</label>
              <Input
                type="number"
                value={logistics || ''}
                onChange={e => setLogistics(Number(e.target.value))}
                placeholder="4 000"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {sellingPrice > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={`${isProfit ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <CardContent className="p-3">
              <div className={`flex items-center gap-1.5 mb-1 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span className="text-xs font-medium">Sof foyda</span>
              </div>
              <div className={`text-lg font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                {isProfit ? '+' : ''}{formatPrice(netProfit)}
              </div>
              <div className="text-[10px] text-muted-foreground">so'm</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Percent className="h-3.5 w-3.5" /><span className="text-xs font-medium">Marja</span>
              </div>
              <div className={`text-lg font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{profitMargin.toFixed(1)}%</div>
              <div className="text-[10px] text-muted-foreground">foyda ulushi</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" /><span className="text-xs font-medium">ROI</span>
              </div>
              <div className={`text-lg font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{roi.toFixed(0)}%</div>
              <div className="text-[10px] text-muted-foreground">investitsiya qaytimi</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Truck className="h-3.5 w-3.5" /><span className="text-xs font-medium">Xarajatlar</span>
              </div>
              <div className="text-lg font-bold">{formatPrice(totalExpenses)}</div>
              <div className="text-[10px] text-muted-foreground">so'm jami</div>
            </CardContent>
          </Card>
        </div>
      )}

      {sellingPrice > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-medium mb-2">Xarajatlar tarkibi</div>
            {[
              { label: 'Tovar tannarxi', value: costPrice, color: 'bg-orange-500' },
              { label: 'Yandex komissiya (20%)', value: yandexCommission, color: 'bg-yellow-500' },
              { label: `SellerCloudX (${commissionPercent}%)`, value: platformFee, color: 'bg-blue-500' },
              { label: 'Soliq (4%)', value: tax, color: 'bg-purple-500' },
              { label: 'Logistika', value: logistics, color: 'bg-slate-500' },
            ].map(item => {
              const pct = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{pct.toFixed(0)}%</span>
                  <span className="font-medium whitespace-nowrap w-24 text-right">{formatPrice(item.value)} so'm</span>
                </div>
              );
            })}
            <div className="border-t pt-2 mt-2 flex items-center justify-between text-sm font-bold">
              <span>Jami xarajat</span>
              <span>{formatPrice(totalExpenses)} so'm</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
