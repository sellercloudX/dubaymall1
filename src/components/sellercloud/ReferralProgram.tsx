import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Copy, Gift, Users, TrendingUp, Share2, CheckCircle2, Loader2 } from 'lucide-react';

interface ReferralReward {
  id: string;
  referred_id: string;
  referrer_bonus_uzs: number;
  referred_bonus_uzs: number;
  status: string;
  created_at: string;
}

export function ReferralProgram() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [stats, setStats] = useState({ totalInvites: 0, totalBonus: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadReferralData();
  }, [user?.id]);

  const loadReferralData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Get or create referral code
      const { data: codeData } = await supabase.rpc('get_or_create_referral_code', { p_user_id: user.id });
      setReferralCode(codeData as string);

      // Get referral stats
      const { data: codeRow } = await supabase
        .from('referral_codes')
        .select('total_invites, total_bonus_uzs')
        .eq('user_id', user.id)
        .single();
      
      if (codeRow) {
        setStats({
          totalInvites: codeRow.total_invites || 0,
          totalBonus: Number(codeRow.total_bonus_uzs) || 0,
        });
      }

      // Get rewards history
      const { data: rewardsData } = await supabase
        .from('referral_rewards')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      setRewards((rewardsData as ReferralReward[]) || []);
    } catch (err) {
      console.error('Referral load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    if (!referralCode) return;
    const link = `${window.location.origin}?ref=${referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Havola nusxalandi!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareCode = async () => {
    if (!referralCode) return;
    const link = `${window.location.origin}?ref=${referralCode}`;
    const text = `SellerCloudX — marketplace avtomatizatsiya platformasi. Ro'yxatdan o'ting va 10,000 so'm bonus oling! ${link}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SellerCloudX', text, url: link });
      } catch {}
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Matn nusxalandi!');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Referral banner */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-primary" /> Do'stingizni taklif qiling
          </CardTitle>
          <CardDescription>
            Har bir do'stingiz uchun <strong className="text-primary">20,000 so'm</strong> bonus oling. 
            Do'stingiz ham <strong className="text-primary">10,000 so'm</strong> oladi!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Referral link */}
          <div className="flex gap-2">
            <Input
              readOnly
              value={referralCode ? `${window.location.origin}?ref=${referralCode}` : ''}
              className="text-xs font-mono bg-background"
            />
            <Button size="icon" variant="outline" onClick={copyCode} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={shareCode} className="flex-1" size="sm">
              <Share2 className="h-4 w-4 mr-1.5" /> Ulashish
            </Button>
            <Button variant="outline" size="sm" onClick={copyCode} className="flex-1">
              <Copy className="h-4 w-4 mr-1.5" /> Kodni nusxalash
            </Button>
          </div>

          {/* Referral code display */}
          <div className="text-center py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sizning kodingiz</p>
            <p className="text-2xl font-bold text-primary font-mono mt-1">{referralCode}</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{stats.totalInvites}</p>
            <p className="text-[10px] text-muted-foreground">Taklif qilingan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{stats.totalBonus.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Jami bonus (UZS)</p>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Qanday ishlaydi?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { step: '1', text: "Havolangizni do'stlaringizga yuboring", icon: Share2 },
              { step: '2', text: "Do'stingiz ro'yxatdan o'tadi va tarifni faollashtiradi", icon: Users },
              { step: '3', text: "Ikkalangiz ham bonus olasiz!", icon: Gift },
            ].map(({ step, text, icon: Icon }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{step}</span>
                </div>
                <p className="text-sm">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rewards history */}
      {rewards.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gift className="h-4 w-4" /> Bonuslar tarixi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-sm">Do'st taklifi</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-primary">+{r.referrer_bonus_uzs.toLocaleString()}</span>
                    <Badge variant="secondary" className="ml-2 text-[8px]">{r.status === 'paid' ? 'To\'langan' : 'Kutilmoqda'}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
