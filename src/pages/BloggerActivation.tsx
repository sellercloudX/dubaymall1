 import { useState, useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { useAuth } from '@/contexts/AuthContext';
 import { Layout } from '@/components/Layout';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Badge } from '@/components/ui/badge';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { 
   Users, Instagram, Youtube, MessageCircle, CheckCircle2, Clock, XCircle,
   Loader2, ArrowRight, Upload, Link as LinkIcon
 } from 'lucide-react';
 
 interface BloggerProfile {
   id: string;
   social_platform: string;
   social_username: string;
   social_url: string;
   followers_count: number;
   screenshots: string[];
   niche: string;
   description: string;
   status: 'pending' | 'approved' | 'rejected';
   rejection_reason?: string;
 }
 
 export default function BloggerActivation() {
   const { user, loading: authLoading } = useAuth();
   const navigate = useNavigate();
   const [profile, setProfile] = useState<BloggerProfile | null>(null);
   const [hasBloggerRole, setHasBloggerRole] = useState(false);
   const [loading, setLoading] = useState(true);
   const [submitting, setSubmitting] = useState(false);
   
   const [formData, setFormData] = useState({
     social_platform: 'instagram',
     social_username: '',
     social_url: '',
     followers_count: '',
     niche: '',
     description: '',
   });
 
   useEffect(() => {
     if (!authLoading && !user) {
       navigate('/partner-auth?role=blogger');
       return;
     }
     if (user) {
       fetchData();
     }
   }, [user, authLoading, navigate]);
 
   const fetchData = async () => {
     if (!user) return;
     
     try {
       // Check blogger role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'blogger')
          .maybeSingle();
        
        setHasBloggerRole(!!roleData);
  
        // Fetch profile
        const { data: profileData } = await supabase
          .from('blogger_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
       
       if (profileData) {
         setProfile(profileData as BloggerProfile);
         setFormData({
           social_platform: profileData.social_platform || 'instagram',
           social_username: profileData.social_username || '',
           social_url: profileData.social_url || '',
           followers_count: profileData.followers_count?.toString() || '',
           niche: profileData.niche || '',
           description: profileData.description || '',
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
       // First add blogger role if not exists
       if (!hasBloggerRole) {
         const { error: roleError } = await supabase
           .from('user_roles')
           .insert({ user_id: user.id, role: 'blogger' });
         
         if (roleError && !roleError.message.includes('duplicate')) {
           throw roleError;
         }
       }
 
       // Upsert blogger profile
       const { error } = await supabase
         .from('blogger_profiles')
         .upsert({
           user_id: user.id,
           social_platform: formData.social_platform,
           social_username: formData.social_username,
           social_url: formData.social_url,
           followers_count: parseInt(formData.followers_count) || 0,
           niche: formData.niche,
           description: formData.description,
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
 
   const platformIcons: Record<string, any> = {
     instagram: Instagram,
     telegram: MessageCircle,
     youtube: Youtube,
     tiktok: Users,
   };
 
   const PlatformIcon = platformIcons[formData.social_platform] || Users;
 
   if (authLoading || loading) {
     return (
       <Layout>
         <div className="flex items-center justify-center min-h-[60vh]">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </Layout>
     );
   }
 
   // If approved, redirect to blogger dashboard
   if (profile?.status === 'approved') {
     return (
       <Layout>
         <div className="container max-w-2xl mx-auto px-4 py-8">
            <Card className="border-primary/50">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
               <h2 className="text-2xl font-bold mb-2">Akkount aktivlashtirilgan!</h2>
               <p className="text-muted-foreground mb-6">
                 Siz endi blogger sifatida affiliate marketing qilishingiz mumkin
               </p>
               <Button onClick={() => navigate('/blogger')}>
                 Blogger paneliga o'tish
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
             <Users className="h-8 w-8 text-primary" />
             Blogger aktivatsiyasi
           </h1>
           <p className="text-muted-foreground mt-2">
             Affiliate marketing orqali daromad olish uchun profilingizni to'ldiring
           </p>
         </div>
 
         {/* Status Card */}
         {profile && (
            <Card className={`mb-6 ${
              profile.status === 'pending' ? 'border-warning/50' : 
              profile.status === 'rejected' ? 'border-destructive/50' : ''
            }`}>
             <CardContent className="pt-6">
               <div className="flex items-center gap-4">
                 {profile.status === 'pending' && (
                   <>
                      <Clock className="h-8 w-8 text-warning" />
                      <div>
                        <Badge variant="outline" className="bg-warning/10 text-warning">
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
                 <PlatformIcon className="h-5 w-5 text-purple-500" />
                 Ijtimoiy tarmoq ma'lumotlari
               </CardTitle>
               <CardDescription>
                 Asosiy faoliyat olib boradigan platformangizni ko'rsating
               </CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label>Platforma *</Label>
                   <Select 
                     value={formData.social_platform}
                     onValueChange={(v) => setFormData(prev => ({ ...prev, social_platform: v }))}
                   >
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="instagram">Instagram</SelectItem>
                       <SelectItem value="telegram">Telegram</SelectItem>
                       <SelectItem value="youtube">YouTube</SelectItem>
                       <SelectItem value="tiktok">TikTok</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="social_username">Username *</Label>
                   <Input
                     id="social_username"
                     name="social_username"
                     value={formData.social_username}
                     onChange={handleChange}
                     placeholder="@username"
                     required
                   />
                 </div>
               </div>
 
               <div className="grid md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="social_url">Profil havolasi *</Label>
                   <div className="relative">
                     <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Input
                       id="social_url"
                       name="social_url"
                       value={formData.social_url}
                       onChange={handleChange}
                       placeholder="https://instagram.com/username"
                       className="pl-10"
                       required
                     />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="followers_count">Obunachilar soni *</Label>
                   <Input
                     id="followers_count"
                     name="followers_count"
                     type="number"
                     value={formData.followers_count}
                     onChange={handleChange}
                     placeholder="10000"
                     required
                   />
                 </div>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="niche">Yo'nalish (niche) *</Label>
                 <Select 
                   value={formData.niche}
                   onValueChange={(v) => setFormData(prev => ({ ...prev, niche: v }))}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Tanlang..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="fashion">Moda va kiyimlar</SelectItem>
                     <SelectItem value="tech">Texnologiya</SelectItem>
                     <SelectItem value="beauty">Go'zallik</SelectItem>
                     <SelectItem value="food">Ovqatlanish</SelectItem>
                     <SelectItem value="lifestyle">Turmush tarzi</SelectItem>
                     <SelectItem value="sport">Sport va salomatlik</SelectItem>
                     <SelectItem value="travel">Sayohat</SelectItem>
                     <SelectItem value="education">Ta'lim</SelectItem>
                     <SelectItem value="business">Biznes</SelectItem>
                     <SelectItem value="other">Boshqa</SelectItem>
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label htmlFor="description">O'zingiz haqingizda</Label>
                 <Textarea
                   id="description"
                   name="description"
                   value={formData.description}
                   onChange={handleChange}
                   placeholder="Qanday kontent yaratishingiz, auditoriyangiz haqida..."
                   rows={3}
                 />
               </div>
             </CardContent>
           </Card>
 
           <Card className="mb-6 border-dashed">
             <CardContent className="pt-6">
               <div className="text-center text-muted-foreground">
                 <Upload className="h-8 w-8 mx-auto mb-2" />
                 <p className="text-sm">
                   Statistika skrinshoti (ixtiyoriy)
                 </p>
                 <p className="text-xs mt-1">
                   Admin tekshiruvi uchun statistikangizni skrinshot qilib yuborishingiz mumkin
                 </p>
               </div>
             </CardContent>
           </Card>
 
           <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-lg mb-6">
             <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">
               💡 Blogger sifatida qanday ishlaysiz?
             </h4>
             <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1">
               <li>• Mahsulotlarni tanlab, shaxsiy referral havola olasiz</li>
               <li>• Havolani auditoriyangiz bilan baham ko'rasiz</li>
               <li>• Har bir sotuvdan 10-25% komissiya olasiz</li>
               <li>• Pul yechib olayotganda platformaga faqat kelishilgan foiz to'laysiz</li>
             </ul>
           </div>
 
           <Button 
             type="submit" 
             className="w-full bg-purple-600 hover:bg-purple-700" 
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
                 <CheckCircle2 className="mr-2 h-4 w-4" />
                 Aktivatsiya uchun yuborish
               </>
             )}
           </Button>
         </form>
       </div>
     </Layout>
   );
 }