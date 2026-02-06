import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Percent
} from 'lucide-react';

export function PromoCalculator() {
  const [originalPrice, setOriginalPrice] = useState(500000);
  const [costPrice, setCostPrice] = useState(300000);
  const [discountPercent, setDiscountPercent] = useState([15]);
  const [expectedSalesIncrease, setExpectedSalesIncrease] = useState([50]);
  const [currentMonthlySales, setCurrentMonthlySales] = useState(30);
  const [platformCommission, setPlatformCommission] = useState(5);

  const calculations = useMemo(() => {
    const discount = discountPercent[0];
    const salesBoost = expectedSalesIncrease[0];

    // Before promo
    const commissionBefore = originalPrice * (platformCommission / 100);
    const profitPerUnit = originalPrice - costPrice - commissionBefore;
    const monthlyProfitBefore = profitPerUnit * currentMonthlySales;

    // After promo
    const salePrice = originalPrice * (1 - discount / 100);
    const commissionAfter = salePrice * (platformCommission / 100);
    const profitPerUnitPromo = salePrice - costPrice - commissionAfter;
    const boostedSales = Math.round(currentMonthlySales * (1 + salesBoost / 100));
    const monthlyProfitAfter = profitPerUnitPromo * boostedSales;

    // Difference
    const profitDifference = monthlyProfitAfter - monthlyProfitBefore;
    const isProfitable = profitPerUnitPromo > 0;
    const isGoodDeal = monthlyProfitAfter >= monthlyProfitBefore;

    // Break-even
    const breakEvenSales = profitPerUnitPromo > 0 
      ? Math.ceil(monthlyProfitBefore / profitPerUnitPromo) 
      : Infinity;

    return {
      salePrice,
      profitPerUnit,
      profitPerUnitPromo,
      monthlyProfitBefore,
      monthlyProfitAfter,
      profitDifference,
      isProfitable,
      isGoodDeal,
      boostedSales,
      breakEvenSales,
      commissionBefore: Math.round(commissionBefore),
      commissionAfter: Math.round(commissionAfter),
    };
  }, [originalPrice, costPrice, discountPercent, expectedSalesIncrease, currentMonthlySales, platformCommission]);

  const formatCurrency = (value: number) => `${value.toLocaleString()} so'm`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Promo samaradorlik kalkulyatori
        </h2>
        <p className="text-sm text-muted-foreground">
          Chegirma qilganda foyda/zararni oldindan hisoblang
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ma'lumotlarni kiriting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label>Asl narx (so'm)</Label>
              <Input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
                min={0}
                step={10000}
              />
            </div>

            <div>
              <Label>Tannarx (so'm)</Label>
              <Input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value) || 0)}
                min={0}
                step={10000}
              />
            </div>

            <div>
              <Label>Platforma komissiyasi (%)</Label>
              <Input
                type="number"
                value={platformCommission}
                onChange={(e) => setPlatformCommission(Number(e.target.value) || 0)}
                min={0}
                max={50}
                step={1}
              />
            </div>

            <div>
              <Label>Oylik sotuvlar soni (hozirgi)</Label>
              <Input
                type="number"
                value={currentMonthlySales}
                onChange={(e) => setCurrentMonthlySales(Number(e.target.value) || 0)}
                min={0}
              />
            </div>

            <div>
              <Label className="flex items-center justify-between">
                <span>Chegirma</span>
                <Badge variant="secondary">{discountPercent[0]}%</Badge>
              </Label>
              <Slider
                min={5}
                max={70}
                step={5}
                value={discountPercent}
                onValueChange={setDiscountPercent}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5%</span>
                <span>70%</span>
              </div>
            </div>

            <div>
              <Label className="flex items-center justify-between">
                <span>Kutilayotgan sotuv o'sishi</span>
                <Badge variant="secondary">+{expectedSalesIncrease[0]}%</Badge>
              </Label>
              <Slider
                min={0}
                max={300}
                step={10}
                value={expectedSalesIncrease}
                onValueChange={setExpectedSalesIncrease}
                className="mt-2"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span>+300%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {/* Verdict */}
          <Card className={calculations.isGoodDeal ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-destructive/50 bg-destructive/5'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                {calculations.isGoodDeal ? (
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                )}
                <div>
                  <h3 className="font-bold text-lg">
                    {calculations.isGoodDeal ? 'Foydali aksiya!' : 'Zararli aksiya!'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {calculations.isGoodDeal
                      ? `Oylik foyda ${formatCurrency(Math.abs(Math.round(calculations.profitDifference)))} ga oshadi`
                      : `Oylik foyda ${formatCurrency(Math.abs(Math.round(calculations.profitDifference)))} ga kamayadi`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Chegirmasiz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Narx</span>
                  <span className="font-medium">{formatCurrency(originalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Komissiya</span>
                  <span className="text-destructive">-{formatCurrency(calculations.commissionBefore)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>1 ta foyda</span>
                  <span className="font-semibold">{formatCurrency(Math.round(calculations.profitPerUnit))}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span>Oylik ({currentMonthlySales} ta)</span>
                  <span className="font-bold">{formatCurrency(Math.round(calculations.monthlyProfitBefore))}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Chegirma bilan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Narx</span>
                  <span className="font-medium">{formatCurrency(Math.round(calculations.salePrice))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Komissiya</span>
                  <span className="text-destructive">-{formatCurrency(calculations.commissionAfter)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>1 ta foyda</span>
                  <span className={`font-semibold ${calculations.isProfitable ? '' : 'text-destructive'}`}>
                    {formatCurrency(Math.round(calculations.profitPerUnitPromo))}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span>Oylik ({calculations.boostedSales} ta)</span>
                  <span className={`font-bold ${calculations.isGoodDeal ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(Math.round(calculations.monthlyProfitAfter))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Break-even info */}
          {calculations.isProfitable && !calculations.isGoodDeal && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm">
                  <span className="font-medium">Zararsiz bo'lish uchun:</span>{' '}
                  oyiga kamida <span className="font-bold text-primary">{calculations.breakEvenSales} ta</span> sotish kerak
                  (hozirgi {currentMonthlySales} ta o'rniga)
                </p>
              </CardContent>
            </Card>
          )}

          {!calculations.isProfitable && (
            <Card className="border-destructive/50">
              <CardContent className="pt-6 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                <p className="text-sm text-destructive">
                  Diqqat! Bu chegirmada har bir sotuvdan zarar ko'rasiz. Chegirma foizini kamaytiring yoki tannarxni tekshiring.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
