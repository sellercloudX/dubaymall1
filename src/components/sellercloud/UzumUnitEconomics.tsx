import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Calculator, DollarSign, TrendingUp, TrendingDown, Percent,
  Package, Truck, RotateCcw, Receipt, Save, ArrowRight,
  CheckCircle2, XCircle, AlertTriangle, Info,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const fmt = (n: number, d = 0) => n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

interface CalcInputs {
  salePrice: number;
  costPrice: number;
  commissionRate: number;
  logisticsFee: number;
  packagingCost: number;
  returnRate: number;
  returnCost: number;
  taxRate: number;
  otherExpenses: number;
  productName: string;
  sku: string;
}

const defaultInputs: CalcInputs = {
  salePrice: 150000,
  costPrice: 60000,
  commissionRate: 20,
  logisticsFee: 8000,
  packagingCost: 3000,
  returnRate: 5,
  returnCost: 5000,
  taxRate: 12,
  otherExpenses: 0,
  productName: '',
  sku: '',
};

export default function UzumUnitEconomics() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState<CalcInputs>(defaultInputs);
  const [isSaving, setIsSaving] = useState(false);

  const update = useCallback((key: keyof CalcInputs, val: string | number) => {
    setInputs(prev => ({ ...prev, [key]: typeof val === 'string' && key !== 'productName' && key !== 'sku' ? parseFloat(val) || 0 : val }));
  }, []);

  const calc = useMemo(() => {
    const { salePrice, costPrice, commissionRate, logisticsFee, packagingCost, returnRate, returnCost, taxRate, otherExpenses } = inputs;

    const commissionAmount = salePrice * commissionRate / 100;
    const taxAmount = salePrice * taxRate / 100;
    const avgReturnCost = (returnRate / 100) * returnCost;
    const totalExpenses = costPrice + commissionAmount + logisticsFee + packagingCost + avgReturnCost + taxAmount + otherExpenses;
    const netProfit = salePrice - totalExpenses;
    const margin = salePrice > 0 ? (netProfit / salePrice) * 100 : 0;
    const roi = costPrice > 0 ? (netProfit / costPrice) * 100 : 0;
    const breakEvenPrice = totalExpenses;
    const minSalePrice = costPrice > 0 ? costPrice / (1 - commissionRate / 100 - taxRate / 100) + logisticsFee + packagingCost + avgReturnCost + otherExpenses : 0;

    return { commissionAmount, taxAmount, avgReturnCost, totalExpenses, netProfit, margin, roi, breakEvenPrice, minSalePrice };
  }, [inputs]);

  const profitStatus = calc.netProfit > 0 ? 'profit' : calc.netProfit === 0 ? 'breakeven' : 'loss';

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('uzum_unit_economics').insert({
        user_id: user.id,
        product_name: inputs.productName || 'Nomsiz mahsulot',
        sku: inputs.sku,
        sale_price: inputs.salePrice,
        cost_price: inputs.costPrice,
        commission_rate: inputs.commissionRate,
        logistics_fee: inputs.logisticsFee,
        packaging_cost: inputs.packagingCost,
        return_rate_percent: inputs.returnRate,
        return_cost: inputs.returnCost,
        tax_rate: inputs.taxRate,
        other_expenses: inputs.otherExpenses,
      } as any);
      if (error) throw error;
      toast({ title: 'Saqlandi', description: 'Unit ekonomika hisob-kitobi saqlandi' });
    } catch (err: any) {
      toast({ title: 'Xato', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const expenseBreakdown = [
    { label: 'Tannarx', amount: inputs.costPrice, percent: inputs.salePrice > 0 ? (inputs.costPrice / inputs.salePrice) * 100 : 0, color: 'bg-primary' },
    { label: 'Komissiya', amount: calc.commissionAmount, percent: inputs.commissionRate, color: 'bg-accent' },
    { label: 'Logistika', amount: inputs.logisticsFee, percent: inputs.salePrice > 0 ? (inputs.logisticsFee / inputs.salePrice) * 100 : 0, color: 'bg-warning' },
    { label: 'Qadoqlash', amount: inputs.packagingCost, percent: inputs.salePrice > 0 ? (inputs.packagingCost / inputs.salePrice) * 100 : 0, color: 'bg-muted-foreground' },
    { label: 'Qaytish xarajati', amount: calc.avgReturnCost, percent: inputs.salePrice > 0 ? (calc.avgReturnCost / inputs.salePrice) * 100 : 0, color: 'bg-destructive' },
    { label: 'Soliq', amount: calc.taxAmount, percent: inputs.taxRate, color: 'bg-success' },
  ];

  return (
    <div className="space-y-4">
      {/* Result Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className={`border-2 ${profitStatus === 'profit' ? 'border-success/30 bg-success/5' : profitStatus === 'loss' ? 'border-destructive/30 bg-destructive/5' : 'border-warning/30 bg-warning/5'}`}>
          <CardContent className="p-3 text-center">
            {profitStatus === 'profit' ? (
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-success" />
            ) : profitStatus === 'loss' ? (
              <XCircle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            ) : (
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
            )}
            <div className={`text-base font-bold ${profitStatus === 'profit' ? 'text-success' : profitStatus === 'loss' ? 'text-destructive' : 'text-warning'}`}>
              {fmt(calc.netProfit)} so'm
            </div>
            <div className="text-[10px] text-muted-foreground">Sof foyda</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <Percent className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="text-base font-bold text-foreground">{calc.margin.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">Marja</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-accent" />
            <div className="text-base font-bold text-foreground">{calc.roi.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">ROI</div>
          </CardContent>
        </Card>
      </div>

      {/* Input Form */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Hisob-kitob parametrlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Mahsulot nomi</Label>
              <Input
                value={inputs.productName}
                onChange={e => update('productName', e.target.value)}
                placeholder="Masalan: Telefon g'ilofi"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">SKU</Label>
              <Input
                value={inputs.sku}
                onChange={e => update('sku', e.target.value)}
                placeholder="SKU-001"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Sotish narxi (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.salePrice}
                onChange={e => update('salePrice', e.target.value)}
                className="h-8 text-xs font-medium"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Package className="w-3 h-3" /> Tannarx (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.costPrice}
                onChange={e => update('costPrice', e.target.value)}
                className="h-8 text-xs font-medium"
              />
            </div>
          </div>

          {/* Commission slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Percent className="w-3 h-3" /> Uzum komissiya
              </Label>
              <Badge variant="secondary" className="text-[10px] h-4">{inputs.commissionRate}%</Badge>
            </div>
            <Slider
              value={[inputs.commissionRate]}
              onValueChange={([v]) => update('commissionRate', v)}
              min={5}
              max={50}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>5%</span>
              <span>Odatda 20-30%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Logistics & Packaging */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Truck className="w-3 h-3" /> Logistika (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.logisticsFee}
                onChange={e => update('logisticsFee', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Package className="w-3 h-3" /> Qadoqlash (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.packagingCost}
                onChange={e => update('packagingCost', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Returns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Qaytish % 
              </Label>
              <Input
                type="number"
                value={inputs.returnRate}
                onChange={e => update('returnRate', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Qaytish xarajati (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.returnCost}
                onChange={e => update('returnCost', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Tax & Other */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Receipt className="w-3 h-3" /> Soliq stavkasi %
              </Label>
              <Input
                type="number"
                value={inputs.taxRate}
                onChange={e => update('taxRate', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Boshqa xarajat (so'm)
              </Label>
              <Input
                type="number"
                value={inputs.otherExpenses}
                onChange={e => update('otherExpenses', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-accent" />
            Xarajatlar taqsimoti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Visual bar */}
          <div className="flex h-3 rounded-full overflow-hidden">
            {expenseBreakdown.map((item, i) => {
              const width = inputs.salePrice > 0 ? (item.amount / inputs.salePrice) * 100 : 0;
              return width > 0 ? (
                <div key={i} className={`${item.color} opacity-80`} style={{ width: `${Math.max(width, 2)}%` }} />
              ) : null;
            })}
            {calc.netProfit > 0 && inputs.salePrice > 0 && (
              <div className="bg-success" style={{ width: `${(calc.netProfit / inputs.salePrice) * 100}%` }} />
            )}
          </div>

          {/* Legend */}
          <div className="space-y-1.5 mt-3">
            {expenseBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">{fmt(item.amount)} so'm</span>
                  <span className="text-muted-foreground text-[10px]">({item.percent.toFixed(1)}%)</span>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className={profitStatus === 'profit' ? 'text-success' : 'text-destructive'}>Sof foyda</span>
              </div>
              <span className={profitStatus === 'profit' ? 'text-success' : 'text-destructive'}>
                {fmt(calc.netProfit)} so'm ({calc.margin.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <div className="text-[10px] text-muted-foreground">Minimal narx</div>
              <div className="text-sm font-bold text-foreground">{fmt(calc.minSalePrice)} so'm</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded-lg">
              <div className="text-[10px] text-muted-foreground">Zarar chegarasi</div>
              <div className="text-sm font-bold text-foreground">{fmt(calc.breakEvenPrice)} so'm</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full h-9 text-xs">
        <Save className="w-3.5 h-3.5 mr-1.5" />
        {isSaving ? 'Saqlanmoqda...' : 'Hisob-kitobni saqlash'}
      </Button>
    </div>
  );
}
