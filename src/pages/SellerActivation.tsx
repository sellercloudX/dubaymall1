 import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { Layout } from '@/components/Layout';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { 
   Store, Building2, CreditCard, CheckCircle2, Clock, XCircle,
   Loader2, ArrowRight, FileText
 } from 'lucide-react';
 
 interface SellerProfile {
   id: string;
   business_type: string;
   business_name: string;
   inn: string;
   oked: string;
   bank_name: string;
   bank_account: string;
   bank_mfo: string;
   legal_address: string;
   contact_phone: string;
   status: 'pending' | 'approved' | 'rejected';
   rejection_reason?: string;
 }
 
 export default function SellerActivation() {
   const { user, loading: authLoading } = useAuth();
   const navigate = useNavigate();
   const [profile, setProfile] = useState<SellerProfile | null>(null);
   const [hasSellerRole, setHasSellerRole] = useState(false);
   const [loading, setLoading] = useState(true);
   const [submitting, setSubmitting] = useState(false);
   
   const [formData, setFormData] = useState({
     business_type: 'yatt',
     business_name: '',
     inn: '',
     oked: '',
     bank_name: '',
     bank_account: '',
     bank_mfo: '',
     legal_address: '',
     contact_phone: '',
   });
 
   useEffect(() => {
     if (!authLoading && !user) {
       navigate('/partner-auth?role=seller');
       return;
     }
     if (user) {
       fetchData();
     }
   }, [user, authLoading, navigate]);
 
   const fetchData = async () => {
     if (!user) return;
     
     try {
       // Check seller role
       const { data: roleData } = await supabase
         .from('user_roles')
         .select('role')
         .eq('user_id', user.id)
         .eq('role', 'seller')
         .single();
       
       setHasSellerRole(!!roleData);
 
       // Fetch profile
       const { data: profileData } = await supabase
         .from('seller_profiles')
         .select('*')
         .eq('user_id', user.id)
         .single();
       
       if (profileData) {
         setProfile(profileData as SellerProfile);
         setFormData({
           business_type: profileData.business_type || 'yatt',
           business_name: profileData.business_name || '',
           inn: profileData.inn || '',
           oked: profileData.oked || '',
           bank_name: profileData.bank_name || '',
           bank_account: profileData.bank_account || '',
           bank_mfo: profileData.bank_mfo || '',
           legal_address: profileData.legal_address || '',
           contact_phone: profileData.contact_phone || '',
         });
       }
     } catch (err) {
       console.error('Error fetching data:', err);
     } finally {
       setLoading(false);
     }
   };
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) return;
 
     setSubmitting(true);
     try {
       // First add seller role if not exists
       if (!hasSellerRole) {
         const { error: roleError } = await supabase
           .from('user_roles')
           .insert({ user_id: user.id, role: 'seller' });
         
         if (roleError && !roleError.message.includes('duplicate')) {
           throw roleError;
         }
       }
 
       // Upsert seller profile
       const { error } = await supabase
         .from('seller_profiles')
         .upsert({
           user_id: user.id,
           ...formData,
           status: 'pending',
           submitted_at: new Date().toISOString(),
         }, { onConflict: 'user_id' });
 
       if (error) throw error;
 
       toast.success('Ma\'lumotlar yuborildi! Admin tekshiruvidan so\'ng aktivlashtiriladi.');
       fetchData();
     } catch (err: any) {
       toast.error('Xatolik: ' + err.message);
     } finally {
       setSubmitting(false);
     }
   };
 
   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
     setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
   };
 
   if (authLoading || loading) {
     return (
       <Layout>
         <div className="flex items-center justify-center min-h-[60vh]">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </Layout>
     );
   }
 
   // If approved, redirect to seller dashboard
   if (profile?.status === 'approved') {
     return (
       <Layout>
         <div className="container max-w-2xl mx-auto px-4 py-8">
           <Card className="border-green-500/50">
             <CardContent className="pt-6 text-center">
               <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
               <h2 className="text-2xl font-bold mb-2">Akkount aktivlashtirilgan!</h2>
               <p className="text-muted-foreground mb-6">
                 Siz endi sotuvchi sifatida ishlashingiz mumkin
               </p>
               <Button onClick={() => navigate('/seller')}>
                 Sotuvchi paneliga o'tish
                 <ArrowRight className="ml-2 h-4 w-4" />
               </Button>
             </CardContent>
           </Card>
         </div>
       </Layout>
     );
   }
 
   return (
     <Layout>
       <div className="container max-w-2xl mx-auto px-4 py-8">
         <div className="mb-8">
           <h1 className="text-3xl font-bold flex items-center gap-3">
              <Store className="h-8 w-8 text-primary" />
              Sotuvchi aktivatsiyasi
            </h1>
            <p className="text-muted-foreground mt-2">
              Dubay Mall'da sotuvchi bo'lish uchun biznes ma'lumotlaringizni kiriting
            </p>
         </div>
 
         {/* Status Card */}
         {profile && (
           <Card className={`mb-6 ${
             profile.status === 'pending' ? 'border-amber-500/50' : 
             profile.status === 'rejected' ? 'border-red-500/50' : ''
           }`}>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                 {profile.status === 'pending' && (
                   <>
                     <Clock className="h-8 w-8 text-amber-500" />
                     <div>
                       <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                         Tekshiruvda
                       </Badge>
                       <p className="text-sm text-muted-foreground mt-1">
                         Admin tomonidan tekshirilmoqda. Iltimos kuting...
                       </p>
                     </div>
                   </>
                 )}
                 {profile.status === 'rejected' && (
                   <>
                     <XCircle className="h-8 w-8 text-red-500" />
                     <div>
                       <Badge variant="destructive">Rad etildi</Badge>
                       <p className="text-sm text-red-600 mt-1">
                         {profile.rejection_reason || 'Ma\'lumotlarni to\'g\'irlab qaytadan yuboring'}
                       </p>
                     </div>
                   </>
                 )}
               </div>
             </CardContent>
           </Card>
         )}
 
         {/* Form */}
         <form onSubmit={handleSubmit}>
           <Card className="mb-6">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Building2 className="h-5 w-5" />
                 Biznes ma'lumotlari
               </CardTitle>
               <CardDescription>
                 Yuridik shaxs yoki yakka tartibdagi tadbirkor ma'lumotlari
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <Label>Biznes turi</Label>
                 <RadioGroup
                   value={formData.business_type}
                   onValueChange={(v) => setFormData(prev => ({ ...prev, business_type: v }))}
                   className="flex gap-4"
                 >
                   <div className="flex items-center space-x-2">
                     <RadioGroupItem value="yatt" id="yatt" />
                     <Label htmlFor="yatt">YaTT (Yakka tartibdagi tadbirkor)</Label>
                   </div>
                   <div className="flex items-center space-x-2">
                     <RadioGroupItem value="ooo" id="ooo" />
                     <Label htmlFor="ooo">OOO/MChJ</Label>
                   </div>
                 </RadioGroup>
               </div>
 
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="business_name">
                     {formData.business_type === 'yatt' ? 'To\'liq ism' : 'Korxona nomi'} *
                   </Label>
                   <Input
                     id="business_name"
                     name="business_name"
                     value={formData.business_name}
                     onChange={handleChange}
                     placeholder={formData.business_type === 'yatt' ? 'Karimov Jasur' : 'OOO "Tech Solutions"'}
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="inn">INN (STIR) *</Label>
                   <Input
                     id="inn"
                     name="inn"
                     value={formData.inn}
                     onChange={handleChange}
                     placeholder="123456789"
                     required
                   />
                 </div>
               </div>
 
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="oked">OKED (faoliyat turi kodi)</Label>
                   <Input
                     id="oked"
                     name="oked"
                     value={formData.oked}
                     onChange={handleChange}
                     placeholder="47111"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="contact_phone">Telefon *</Label>
                   <Input
                     id="contact_phone"
                     name="contact_phone"
                     value={formData.contact_phone}
                     onChange={handleChange}
                     placeholder="+998 90 123 45 67"
                     required
                   />
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="legal_address">Yuridik manzil *</Label>
                 <Textarea
                   id="legal_address"
                   name="legal_address"
                   value={formData.legal_address}
                   onChange={handleChange}
                   placeholder="Toshkent sh., Chilonzor tumani, ..."
                   required
                 />
               </div>
             </CardContent>
           </Card>
 
           <Card className="mb-6">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <CreditCard className="h-5 w-5" />
                 Bank ma'lumotlari
               </CardTitle>
               <CardDescription>
                 Pul o'tkazmalari uchun bank hisob raqami
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="bank_name">Bank nomi *</Label>
                   <Input
                     id="bank_name"
                     name="bank_name"
                     value={formData.bank_name}
                     onChange={handleChange}
                     placeholder="Ipak Yo'li banki"
                     required
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="bank_mfo">MFO *</Label>
                   <Input
                     id="bank_mfo"
                     name="bank_mfo"
                     value={formData.bank_mfo}
                     onChange={handleChange}
                     placeholder="00873"
                     required
                   />
                 </div>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="bank_account">Hisob raqam *</Label>
                 <Input
                   id="bank_account"
                   name="bank_account"
                   value={formData.bank_account}
                   onChange={handleChange}
                   placeholder="20208000123456789012"
                   required
                 />
               </div>
             </CardContent>
           </Card>
 
           <Button 
             type="submit" 
             className="w-full" 
             size="lg"
             disabled={submitting || profile?.status === 'pending'}
           >
             {submitting ? (
               <>
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 Yuborilmoqda...
               </>
             ) : profile?.status === 'pending' ? (
               <>
                 <Clock className="mr-2 h-4 w-4" />
                 Tekshiruvda...
               </>
             ) : (
               <>
                 <FileText className="mr-2 h-4 w-4" />
                 Aktivatsiya uchun yuborish
               </>
             )}
           </Button>
         </form>
       </div>
     </Layout>
   );
 }