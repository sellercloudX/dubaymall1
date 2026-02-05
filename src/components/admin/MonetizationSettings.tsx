import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { usePlatformSettings, SalesCommissionSettings, BloggerFeeSettings, SubscriptionPlans, PromoPeriod } from '@/hooks/usePlatformSettings';
import { Percent, CreditCard, Gift, Calendar, Save, Loader2 } from 'lucide-react';

export default function MonetizationSettings() {
  const { settings, isLoading, updateSetting } = usePlatformSettings();
  
  // Local state for editing
  const [salesCommission, setSalesCommission] = useState<SalesCommissionSettings | null>(null);
  const [bloggerFee, setBloggerFee] = useState<BloggerFeeSettings | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlans | null>(null);
  const [promoPeriod, setPromoPeriod] = useState<PromoPeriod | null>(null);

  // Initialize local state when settings load
  useEffect(() => {
    if (settings) {
      setSalesCommission(settings.salesCommission);
      setBloggerFee(settings.bloggerFee);
      setSubscriptionPlans(settings.subscriptionPlans);
      setPromoPeriod(settings.promoPeriod);
    }
  }, [settings]);

  const handleSaveSalesCommission = () => {
    if (salesCommission) {
      updateSetting.mutate({ key: 'sales_commission', value: salesCommission });
    }
  };

  const handleSaveBloggerFee = () => {
    if (bloggerFee) {
      updateSetting.mutate({ key: 'blogger_platform_fee', value: bloggerFee });
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
        <p className="text-muted-foreground">Platform daromad manbalarini boshqaring</p>
      </div>

      {/* Grid Layout for Settings */}
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
                  <p className="text-xs text-muted-foreground">Har sotuvdan chegiriladigan foiz</p>
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

        {/* Blogger Fee Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Percent className="h-5 w-5 text-purple-500" />
                Blogger platform to'lovi
              </CardTitle>
              <CardDescription>
                Blogger komissiyasidan platform oladigan ulush
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Asosiy to'lov (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={bloggerFee?.percent || 0}
                    onChange={(e) => setBloggerFee(prev => prev ? { ...prev, percent: Number(e.target.value) } : null)}
                  />
                  <p className="text-xs text-muted-foreground">Blogger komissiyasidan platform ulushi</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Aksiya rejimi</Label>
                    <Switch
                      checked={bloggerFee?.is_promo || false}
                      onCheckedChange={(checked) => setBloggerFee(prev => prev ? { ...prev, is_promo: checked } : null)}
                    />
                  </div>
                  
                  {bloggerFee?.is_promo && (
                    <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Aksiya to'lovi (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={bloggerFee?.promo_percent || 0}
                          onChange={(e) => setBloggerFee(prev => prev ? { ...prev, promo_percent: Number(e.target.value) } : null)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tugash sanasi</Label>
                        <Input
                          type="date"
                          value={bloggerFee?.promo_end_date || ''}
                          onChange={(e) => setBloggerFee(prev => prev ? { ...prev, promo_end_date: e.target.value } : null)}
                        />
                      </div>
                    </div>
                  )}
                </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveBloggerFee} disabled={updateSetting.isPending}>
                  {updateSetting.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Saqlash
                </Button>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Subscription Plans Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-blue-500" />
                Obuna tariflari
              </CardTitle>
              <CardDescription>
                Sotuvchilar uchun oylik obuna tariflari
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                {/* Basic Plan */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">Basic</Badge>
                    <span className="text-sm text-muted-foreground">Boshlang'ich</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Narxi (so'm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={subscriptionPlans?.basic.price || 0}
                      onChange={(e) => setSubscriptionPlans(prev => prev ? {
                        ...prev,
                        basic: { ...prev.basic, price: Number(e.target.value) }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mahsulot limiti</Label>
                    <Input
                      type="number"
                      min="0"
                      value={subscriptionPlans?.basic.product_limit || 0}
                      onChange={(e) => setSubscriptionPlans(prev => prev ? {
                        ...prev,
                        basic: { ...prev.basic, product_limit: Number(e.target.value) }
                      } : null)}
                    />
                  </div>
                </div>

                {/* Pro Plan */}
                <div className="space-y-3 p-3 border rounded-lg border-primary/50 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-primary text-xs">Pro</Badge>
                    <span className="text-sm text-muted-foreground">Tavsiya etilgan</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Narxi (so'm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={subscriptionPlans?.pro.price || 0}
                      onChange={(e) => setSubscriptionPlans(prev => prev ? {
                        ...prev,
                        pro: { ...prev.pro, price: Number(e.target.value) }
                      } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mahsulot limiti</Label>
                    <Input
                      type="number"
                      min="0"
                      value={subscriptionPlans?.pro.product_limit || 0}
                      onChange={(e) => setSubscriptionPlans(prev => prev ? {
                        ...prev,
                        pro: { ...prev.pro, product_limit: Number(e.target.value) }
                      } : null)}
                    />
                  </div>
                </div>

                {/* Enterprise Plan */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Enterprise</Badge>
                    <span className="text-sm text-muted-foreground">Premium</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Narxi (so'm)</Label>
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
                  <div className="space-y-2">
                    <Label>Mahsulot limiti (-1 = cheksiz)</Label>
                    <Input
                      type="number"
                      min="-1"
                      value={subscriptionPlans?.enterprise.product_limit || 0}
                      onChange={(e) => setSubscriptionPlans(prev => prev ? {
                        ...prev,
                        enterprise: { ...prev.enterprise, product_limit: Number(e.target.value) }
                      } : null)}
                    />
                  </div>
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
