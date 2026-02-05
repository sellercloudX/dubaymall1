 import { useState, useEffect } from 'react';
 import { useNavigate, useSearchParams, Link } from 'react-router-dom';
 import { useLanguage } from '@/contexts/LanguageContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { LanguageSwitcher } from '@/components/LanguageSwitcher';
 import { ShoppingBag, Eye, EyeOff, Loader2, Store, Users, Globe, ArrowLeft } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 import { z } from 'zod';
 
 const emailSchema = z.string().email();
 const passwordSchema = z.string().min(6);
 
 type PartnerRole = 'seller' | 'blogger' | 'sellercloud';
 
 export default function PartnerAuth() {
   const { t } = useLanguage();
   const { user, signIn, signUp } = useAuth();
   const navigate = useNavigate();
   const { toast } = useToast();
   const [searchParams] = useSearchParams();
   
   const [mode, setMode] = useState<'login' | 'register'>(
     searchParams.get('mode') === 'login' ? 'login' : 'register'
   );
   const [selectedRole, setSelectedRole] = useState<PartnerRole>(
     (searchParams.get('role') as PartnerRole) || 'seller'
   );
   const [loading, setLoading] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
   
   const [formData, setFormData] = useState({
     email: '',
     password: '',
     confirmPassword: '',
     fullName: '',
   });
   
   const [errors, setErrors] = useState<Record<string, string>>({});
 
   // Redirect based on role if already logged in
   useEffect(() => {
     if (user) {
       const redirectPath = searchParams.get('redirect');
       if (redirectPath) {
         navigate(redirectPath);
       } else {
         // Redirect based on role
         switch (selectedRole) {
           case 'seller':
             navigate('/seller-activation');
             break;
           case 'blogger':
             navigate('/blogger-activation');
             break;
           case 'sellercloud':
             navigate('/seller-cloud');
             break;
           default:
             navigate('/dashboard');
         }
       }
     }
   }, [user, navigate, selectedRole, searchParams]);
 
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
       if (!formData.fullName) {
         newErrors.fullName = 'Ism familiya kiritilishi shart';
       }
     }
     
     setErrors(newErrors);
     return Object.keys(newErrors).length === 0;
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
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
         }
       } else {
         const { error } = await signUp(formData.email, formData.password, formData.fullName);
         
         if (error) {
           toast({
             title: 'Xatolik',
             description: error.message,
             variant: 'destructive',
           });
           return;
         }
 
         // Wait for auth to complete, then add role
         toast({
           title: 'Muvaffaqiyat',
           description: 'Emailingizni tasdiqlang va qayta kiring',
         });
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
     if (errors[name]) {
       setErrors(prev => ({ ...prev, [name]: '' }));
     }
   };
 
  const roleOptions = [
      {
        value: 'seller' as PartnerRole,
        label: 'Sotuvchi',
        description: "Dubay Mall'da do'kon ochish",
        icon: Store,
        color: 'text-primary',
      },
     {
       value: 'blogger' as PartnerRole,
       label: 'Blogger',
       description: 'Affiliate marketing orqali daromad',
       icon: Users,
       color: 'text-purple-500',
     },
     {
       value: 'sellercloud' as PartnerRole,
       label: 'SellerCloudX',
       description: 'Marketplace avtomatizatsiya',
       icon: Globe,
       color: 'text-amber-500',
     },
   ];
 
   return (
     <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
       {/* Header */}
       <div className="absolute top-4 left-4">
         <Button variant="ghost" size="sm" asChild>
           <Link to="/partnership">
             <ArrowLeft className="h-4 w-4 mr-2" />
             Orqaga
           </Link>
         </Button>
       </div>
       <div className="absolute top-4 right-4">
         <LanguageSwitcher />
       </div>
       
       {/* Logo */}
       <Link to="/" className="flex items-center gap-2 mb-8">
         <ShoppingBag className="h-10 w-10 text-primary" />
         <span className="text-2xl font-bold">Hamkorlik</span>
       </Link>
       
       {/* Auth Card */}
       <Card className="w-full max-w-md animate-fade-in">
         <CardHeader className="text-center">
           <CardTitle className="text-2xl">
             {mode === 'login' ? 'Hamkor hisobiga kirish' : 'Hamkor sifatida ro\'yxatdan o\'tish'}
           </CardTitle>
           <CardDescription>
             Sotuvchi, blogger yoki marketplace integratori sifatida ishlang
           </CardDescription>
         </CardHeader>
         
         <form onSubmit={handleSubmit}>
           <CardContent className="space-y-4">
             {/* Role Selection - Only show on register */}
             {mode === 'register' && (
               <div className="space-y-3">
                 <Label>Yo'nalishni tanlang</Label>
                 <RadioGroup 
                   value={selectedRole} 
                   onValueChange={(v) => setSelectedRole(v as PartnerRole)}
                   className="space-y-2"
                 >
                   {roleOptions.map((option) => (
                     <label 
                       key={option.value}
                       htmlFor={option.value}
                       className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-all ${
                         selectedRole === option.value 
                           ? 'border-primary bg-primary/5' 
                           : 'border-border hover:border-primary/50'
                       }`}
                     >
                       <RadioGroupItem value={option.value} id={option.value} />
                       <option.icon className={`h-5 w-5 ${option.color}`} />
                       <div className="flex-1">
                         <span className="cursor-pointer font-medium block">
                           {option.label}
                         </span>
                         <p className="text-xs text-muted-foreground">{option.description}</p>
                       </div>
                     </label>
                   ))}
                 </RadioGroup>
               </div>
             )}
 
             {mode === 'register' && (
               <div className="space-y-2">
                 <Label htmlFor="fullName">Ism Familiya *</Label>
                 <Input
                   id="fullName"
                   name="fullName"
                   type="text"
                   value={formData.fullName}
                   onChange={handleChange}
                   placeholder="Ism Familiya"
                   className={errors.fullName ? 'border-destructive' : ''}
                 />
                 {errors.fullName && (
                   <p className="text-sm text-destructive">{errors.fullName}</p>
                 )}
               </div>
             )}
             
             <div className="space-y-2">
               <Label htmlFor="email">{t.email}</Label>
               <Input
                 id="email"
                 name="email"
                 type="email"
                 value={formData.email}
                 onChange={handleChange}
                 placeholder="email@example.com"
                 className={errors.email ? 'border-destructive' : ''}
               />
               {errors.email && (
                 <p className="text-sm text-destructive">{errors.email}</p>
               )}
             </div>
             
             <div className="space-y-2">
               <Label htmlFor="password">{t.password}</Label>
               <div className="relative">
                 <Input
                   id="password"
                   name="password"
                   type={showPassword ? 'text' : 'password'}
                   value={formData.password}
                   onChange={handleChange}
                   placeholder="••••••••"
                   className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                 />
                 <button
                   type="button"
                   className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                   onClick={() => setShowPassword(!showPassword)}
                 >
                   {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                 </button>
               </div>
               {errors.password && (
                 <p className="text-sm text-destructive">{errors.password}</p>
               )}
             </div>
             
             {mode === 'register' && (
               <div className="space-y-2">
                 <Label htmlFor="confirmPassword">{t.confirmPassword}</Label>
                 <Input
                   id="confirmPassword"
                   name="confirmPassword"
                   type="password"
                   value={formData.confirmPassword}
                   onChange={handleChange}
                   placeholder="••••••••"
                   className={errors.confirmPassword ? 'border-destructive' : ''}
                 />
                 {errors.confirmPassword && (
                   <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                 )}
               </div>
             )}
           </CardContent>
           
           <CardFooter className="flex flex-col gap-4">
             <Button type="submit" className="w-full" disabled={loading}>
               {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               {mode === 'login' ? t.signIn : "Ro'yxatdan o'tish"}
             </Button>
             
             <p className="text-sm text-muted-foreground">
               {mode === 'login' ? "Hisobingiz yo'qmi?" : 'Hisobingiz bormi?'}{' '}
               <button
                 type="button"
                 className="text-primary hover:underline font-medium"
                 onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
               >
                 {mode === 'login' ? "Ro'yxatdan o'tish" : 'Kirish'}
               </button>
             </p>
 
             <p className="text-xs text-muted-foreground text-center">
               Xaridor sifatida ro'yxatdan o'tish uchun{' '}
               <Link to="/auth" className="text-primary hover:underline">bu yerga</Link> bosing
             </p>
           </CardFooter>
         </form>
       </Card>
     </div>
   );
 }