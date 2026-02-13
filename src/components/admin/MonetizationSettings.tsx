import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePlatformSettings, SalesCommissionSettings, SubscriptionPlans, PromoPeriod } from '@/hooks/usePlatformSettings';
import { Percent, CreditCard, Gift, Save, Loader2 } from 'lucide-react';

export default function MonetizationSettings() {
  const { settings, isLoading, updateSetting } = usePlatformSettings();
  
  const [salesCommission, setSalesCommission] = useState<SalesCommissionSettings | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlans | null>(null);
  const [promoPeriod, setPromoPeriod] = useState<PromoPeriod | null>(null);

  useEffect(() => {
    if (settings) {
      setSalesCommission(settings.salesCommission);
      setSubscriptionPlans(settings.subscriptionPlans);
      setPromoPeriod(settings.promoPeriod);
    }
  }, [settings]);

  const handleSaveSalesCommission = () => {
    if (salesCommission) {
      updateSetting.mutate({ key: 'sales_commission', value: salesCommission });
    }
  };

  const handleSaveSubscriptionPlans = () => {
    if (subscriptionPlans) {
      updateSetting.mutate({ key: 'subscription_plans', value: subscriptionPlans });
    }
  };

  const handleSavePromoPeriod = () => {
    if (promoPeriod) {
      updateSetting.mutate({ key: 'promo_period', value: promoPeriod });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Monetizatsiya sozlamalari</h2>
        <p className="text-muted-foreground">SellerCloudX daromad manbalarini boshqaring</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Commission Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="h-5 w-5 text-emerald-500" />
              Sotuv komissiyasi
            </CardTitle>
            <CardDescription>
              Har bir sotuvdan platform oladigan foiz
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="commission-percent">Asosiy komissiya (%)</Label>
              <Input
                id="commission-percent"
                type="number"
                min="0"
                max="100"
                value={salesCommission?.percent || 0}
                onChange={(e) => setSalesCommission(prev => prev ? { ...prev, percent: Number(e.target.value) } : null)}
              />
              <p className="text-xs text-muted-foreground">Har sotuvdan chegiriladigan foiz (default: 4%)</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="commission-promo">Aksiya rejimi</Label>
                <Switch
                  id="commission-promo"
                  checked={salesCommission?.is_promo || false}
                  onCheckedChange={(checked) => setSalesCommission(prev => prev ? { ...prev, is_promo: checked } : null)}
                />
              </div>
              
              {salesCommission?.is_promo && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Aksiya komissiyasi (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={salesCommission?.promo_percent || 0}
                      onChange={(e) => setSalesCommission(prev => prev ? { ...prev, promo_percent: Number(e.target.value) } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tugash sanasi</Label>
                    <Input
                      type="date"
                      value={salesCommission?.promo_end_date || ''}
                      onChange={(e) => setSalesCommission(prev => prev ? { ...prev, promo_end_date: e.target.value } : null)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSalesCommission} disabled={updateSetting.isPending}>
                {updateSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Saqlash
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Plans Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5 text-blue-500" />
              Obuna tariflari
            </CardTitle>
            <CardDescription>
              SellerCloudX obuna narxlari va komissiyalar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              {/* Pro (Premium) Plan */}
              <div className="space-y-3 p-4 border rounded-lg border-primary/50 bg-primary/5">
                <div className="flex items-center justify-between">
                  <Badge className="bg-primary text-xs">Premium</Badge>
                  <span className="text-sm text-muted-foreground">$499/oy</span>
                </div>
                <div className="space-y-2">
                  <Label>Narxi (so'm)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={subscriptionPlans?.pro.price || 6300000}
                    onChange={(e) => setSubscriptionPlans(prev => prev ? {
                      ...prev,
                      pro: { ...prev.pro, price: Number(e.target.value) }
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Komissiya (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={salesCommission?.percent || 4}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Yuqoridagi komissiya sozlamasidan olinadi</p>
                </div>
              </div>

              {/* Individual/VIP Plan */}
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Individual / VIP</Badge>
                  <span className="text-sm text-muted-foreground">Kelishuv asosida</span>
                </div>
                <div className="space-y-2">
                  <Label>Minimal narx (so'm)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={subscriptionPlans?.enterprise.price || 0}
                    onChange={(e) => setSubscriptionPlans(prev => prev ? {
                      ...prev,
                      enterprise: { ...prev.enterprise, price: Number(e.target.value) }
                    } : null)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Komissiya: 2% dan. Oboroti $50,000+ sotuvchilar uchun shaxsiy taklif.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSubscriptionPlans} disabled={updateSetting.isPending}>
                {updateSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Saqlash
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Promo Period Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-pink-500" />
            Imtiyozli davr
          </CardTitle>
          <CardDescription>
            Global aksiya davri - barcha to'lovlarni vaqtincha 0 qilish
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-3 border rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10">
            <div>
              <h4 className="font-semibold">Imtiyozli davr faol</h4>
              <p className="text-sm text-muted-foreground">
                Yoqilganda barcha tanlangan to'lovlar 0 bo'ladi
              </p>
            </div>
            <Switch
              checked={promoPeriod?.is_active || false}
              onCheckedChange={(checked) => setPromoPeriod(prev => prev ? { ...prev, is_active: checked } : null)}
            />
          </div>

          {promoPeriod?.is_active && (
            <div className="space-y-4 p-3 bg-muted/50 rounded-lg">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Aksiya nomi</Label>
                  <Input
                    placeholder="Masalan: Yangi yil aksiyasi"
                    value={promoPeriod?.name || ''}
                    onChange={(e) => setPromoPeriod(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tugash sanasi</Label>
                  <Input
                    type="date"
                    value={promoPeriod?.end_date || ''}
                    onChange={(e) => setPromoPeriod(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h5 className="font-medium">Qanday to'lovlar 0 bo'lsin?</h5>
                
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <p className="font-medium">Bepul obuna</p>
                    <p className="text-xs text-muted-foreground">Barcha obunalar bepul</p>
                  </div>
                  <Switch
                    checked={promoPeriod?.free_subscription || false}
                    onCheckedChange={(checked) => setPromoPeriod(prev => prev ? { ...prev, free_subscription: checked } : null)}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">0% komissiya</p>
                    <p className="text-sm text-muted-foreground">Sotuvlardan hech qanday komissiya olinmaydi</p>
                  </div>
                  <Switch
                    checked={promoPeriod?.zero_commission || false}
                    onCheckedChange={(checked) => setPromoPeriod(prev => prev ? { ...prev, zero_commission: checked } : null)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSavePromoPeriod} disabled={updateSetting.isPending}>
              {updateSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Saqlash
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
