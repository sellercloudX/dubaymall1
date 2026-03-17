import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, KeyRound, Mail, User, Phone, CheckCircle2, Shield } from 'lucide-react';

export function ProfilePasswordSetup() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isGoogleUser = user?.app_metadata?.provider === 'google' || 
                       user?.app_metadata?.providers?.includes('google');
  const hasPassword = user?.app_metadata?.providers?.includes('email');

  const handleSetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Parol kamida 6 belgi bo\'lishi kerak');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Parollar mos kelmaydi');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Parol muvaffaqiyatli o\'rnatildi! Endi email va parol bilan kirish mumkin.');
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch {
      toast.error('Kutilmagan xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Profile Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profil ma'lumotlari
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Email</p>
            </div>
          </div>
          {user?.user_metadata?.full_name && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{user.user_metadata.full_name}</p>
                <p className="text-xs text-muted-foreground">Ism</p>
              </div>
            </div>
          )}
          {user?.user_metadata?.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{user.user_metadata.phone}</p>
                <p className="text-xs text-muted-foreground">Telefon</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <p className="text-xs text-muted-foreground">Kirish usuli:</p>
            {isGoogleUser && <Badge variant="secondary" className="text-[10px]">Google</Badge>}
            {hasPassword && <Badge variant="secondary" className="text-[10px]">Email/Parol</Badge>}
            {!isGoogleUser && !hasPassword && <Badge variant="secondary" className="text-[10px]">Email</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Password Setup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {hasPassword ? 'Parolni o\'zgartirish' : 'Parol o\'rnatish'}
          </CardTitle>
          <CardDescription className="text-xs">
            {isGoogleUser && !hasPassword
              ? 'Google orqali kirgansiz. Parol o\'rnatib, keyingi safar email+parol bilan ham kira olasiz.'
              : hasPassword
                ? 'Mavjud parolingizni yangilash'
                : 'Login parol o\'rnating va keyingi safar email+parol bilan kiring'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Parol o'rnatildi!</p>
                <p className="text-xs text-green-600 dark:text-green-400">Endi email va parol bilan kirishingiz mumkin.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  {hasPassword ? 'Yangi parol' : 'Parol'}
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kamida 6 belgi"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Parolni tasdiqlang</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Parolni qayta kiriting"
                />
              </div>
              <Button onClick={handleSetPassword} disabled={loading || !newPassword} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Shield className="mr-2 h-4 w-4" />
                {hasPassword ? 'Parolni yangilash' : 'Parol o\'rnatish'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
