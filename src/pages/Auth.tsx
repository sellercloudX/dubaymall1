import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Crown, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';

const emailSchema = z.string().email();
const passwordSchema = z.string().min(6);
const phoneSchema = z.string().regex(/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/, 'Telefon raqami noto\'g\'ri formatda');

export default function Auth() {
  const { t } = useLanguage();
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

   // Redirect if already logged in
  useEffect(() => {
    if (user) {
       const redirect = searchParams.get('redirect');
       if (redirect) {
         navigate(redirect);
       } else {
         // Capacitor native app or mobile → mobile dashboard
         const isNative = !!(window as any).Capacitor;
         const isMobile = window.innerWidth < 768;
         navigate(isNative || isMobile ? '/seller-cloud-mobile' : '/seller-cloud');
       }
    }
   }, [user, navigate, searchParams]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = t.emailRequired;
    } else if (!emailSchema.safeParse(formData.email).success) {
      newErrors.email = t.invalidEmail;
    }
    
    if (!formData.password) {
      newErrors.password = t.passwordRequired;
    } else if (!passwordSchema.safeParse(formData.password).success) {
      newErrors.password = t.passwordTooShort;
    }
    
    if (mode === 'register') {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t.passwordMismatch;
      }
      
      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Ism familiya kiritish shart';
      }
      
      if (!formData.phone) {
        newErrors.phone = 'Telefon raqami kiritish shart';
      } else {
        const cleanPhone = formData.phone.replace(/\s/g, '');
        if (!phoneSchema.safeParse(cleanPhone).success) {
          newErrors.phone = 'Telefon raqami noto\'g\'ri formatda. Masalan: +998 90 123 45 67';
        }
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrors({ email: t.emailRequired });
      return;
    }
    if (!emailSchema.safeParse(formData.email).success) {
      setErrors({ email: t.invalidEmail });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) {
        toast({ title: 'Xatolik', description: error.message, variant: 'destructive' });
      } else {
        setResetSent(true);
        toast({ title: 'Muvaffaqiyat', description: 'Parolni tiklash havolasi emailingizga yuborildi' });
      }
    } catch {
      toast({ title: 'Xatolik', description: 'Kutilmagan xatolik', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'forgot') {
      await handleForgotPassword();
      return;
    }
    
    if (!validate()) return;
    
    setLoading(true);
    
    try {
      if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password);
        
        if (error) {
          toast({
            title: 'Xatolik',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Muvaffaqiyat',
            description: t.loginSuccess,
          });
          const redirect = searchParams.get('redirect');
          if (redirect) {
            navigate(redirect);
          } else {
            const isMobile = window.innerWidth < 768;
            navigate(isMobile ? '/seller-cloud-mobile' : '/seller-cloud');
          }
        }
      } else {
        const cleanPhone = formData.phone.replace(/\s/g, '');
        const { error } = await signUp(formData.email, formData.password, formData.fullName, cleanPhone);
        
        if (error) {
          toast({
            title: 'Xatolik',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Muvaffaqiyat',
            description: t.registrationSuccess,
          });
          setMode('login');
          setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        }
      }
    } catch (error) {
      toast({
        title: 'Xatolik',
        description: 'Kutilmagan xatolik yuz berdi',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Format phone number as user types
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+]/g, '');
    
    // Add +998 prefix if not present
    if (value && !value.startsWith('+')) {
      value = '+' + value;
    }
    if (value.length > 0 && !value.startsWith('+998')) {
      value = '+998' + value.replace('+', '');
    }
    
    // Format: +998 XX XXX XX XX
    if (value.length > 4) {
      const parts = [value.slice(0, 4)];
      if (value.length > 4) parts.push(value.slice(4, 6));
      if (value.length > 6) parts.push(value.slice(6, 9));
      if (value.length > 9) parts.push(value.slice(9, 11));
      if (value.length > 11) parts.push(value.slice(11, 13));
      value = parts.join(' ');
    }
    
    setFormData(prev => ({ ...prev, phone: value }));
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const isCapacitor = !!(window as any).Capacitor;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4 ${isCapacitor ? 'safe-area-top safe-area-bottom' : ''}`}>
      {/* Header */}
      <div className={`absolute ${isCapacitor ? 'top-[max(env(safe-area-inset-top),20px)]' : 'top-4'} right-4`}>
        <LanguageSwitcher />
      </div>
      
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Crown className="h-5 w-5 text-white" />
        </div>
        <span className="text-2xl font-bold font-display">SellerCloudX</span>
      </div>
      
      {/* Auth Card */}
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {mode === 'forgot' ? 'Parolni tiklash' : mode === 'login' ? t.signIn : t.signUp}
          </CardTitle>
          <CardDescription>
            {mode === 'forgot' ? 'Email manzilingizni kiriting' : t.tagline}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {mode === 'forgot' ? (
              <>
                {resetSent ? (
                  <div className="text-center py-4 space-y-2">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
                    <p className="text-sm text-muted-foreground">Parolni tiklash havolasi <strong>{formData.email}</strong> manziliga yuborildi. Emailingizni tekshiring.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">{t.email}</Label>
                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className={errors.email ? 'border-destructive' : ''} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                )}
              </>
            ) : (
              <>
                {mode === 'register' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t.fullName} *</Label>
                      <Input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} placeholder="Ism Familiya" className={errors.fullName ? 'border-destructive' : ''} />
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t.phone} *</Label>
                      <Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handlePhoneChange} placeholder="+998 90 123 45 67" className={errors.phone ? 'border-destructive' : ''} />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" className={errors.email ? 'border-destructive' : ''} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t.password}</Label>
                    {mode === 'login' && (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setMode('forgot'); setResetSent(false); }}>
                        Parolni unutdingizmi?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input id="password" name="password" type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange} placeholder="••••••••" className={errors.password ? 'border-destructive pr-10' : 'pr-10'} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>
                {mode === 'register' && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" className={errors.confirmPassword ? 'border-destructive' : ''} />
                    {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>
                )}
              </>
            )}
          </CardContent>
          
          <CardFooter className="flex flex-col gap-4">
            {mode === 'forgot' ? (
              <>
                {!resetSent && (
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Tiklash havolasini yuborish
                  </Button>
                )}
                <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setMode('login'); setResetSent(false); }}>
                  ← Kirish sahifasiga qaytish
                </button>
              </>
            ) : (
              <>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'login' ? t.signIn : t.signUp}
                </Button>

                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">yoki</span></div>
                </div>

                <Button type="button" variant="outline" className="w-full" disabled={loading}
                  onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                    if (error) { toast({ title: 'Xatolik', description: error.message, variant: 'destructive' }); }
                  }}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google bilan kirish
                </Button>

                <p className="text-sm text-muted-foreground">
                  {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                  <button type="button" className="text-primary hover:underline font-medium" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                    {mode === 'login' ? t.signUp : t.signIn}
                  </button>
                </p>
              </>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
