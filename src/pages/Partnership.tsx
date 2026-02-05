 import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
 import {
   Store, Users, ArrowRight, CheckCircle, TrendingUp,
   Percent, Globe, Crown, Package, Star, Shield, Zap, Sparkles
} from 'lucide-react';

export default function Partnership() {
  const { t } = useLanguage();
  const { user } = useAuth();
   const navigate = useNavigate();

  const stats = [
    { value: "5,000+", label: "Faol sotuvchilar", icon: Store },
    { value: "50,000+", label: "Mahsulotlar", icon: Package },
    { value: "₿ 2M+", label: "Oylik savdo", icon: TrendingUp },
    { value: "25%", label: "O'rtacha komissiya", icon: Percent },
  ];

   const benefits = [
     { icon: Shield, text: "Xavfsiz to'lov - Payme, Click, Uzcard" },
     { icon: Globe, text: "3 tilda interfeys - O'zbek, Rus, Ingliz" },
     { icon: Zap, text: "AI yordamchi - mahsulot qo'shish va tahlil" },
     { icon: Star, text: "Professional qo'llab-quvvatlash 24/7" },
   ];
 
   const testimonials = [
     {
       name: "Aziza Karimova",
       role: "Sotuvchi",
       text: "AI yordamida mahsulot qo'shish juda oson. Bir haftada 50 ta buyurtma oldim!",
       rating: 5,
     },
     {
       name: "Jasur Toshmatov",
       role: "Blogger",
       text: "Affiliate dasturi orqali oyiga 5 mln so'm ishlab olaman. Ajoyib platforma!",
       rating: 5,
     },
   ];
 
  return (
    <Layout>
      {/* Hero Section */}
       <section className="relative overflow-hidden min-h-[70vh] flex items-center">
         <div className="absolute inset-0 bg-mesh" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
         <div className="absolute top-20 left-[10%] w-64 h-64 bg-primary/15 rounded-full blur-3xl" />
         <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
 
         <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
             <Badge className="mb-6 px-5 py-2.5 text-sm font-medium bg-primary/10 text-primary border-primary/20">
               <Sparkles className="h-4 w-4 mr-2" />
              Hamkorlik dasturi
            </Badge>
             <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8">
               <span className="text-foreground">Biz bilan birga</span>
               <br />
               <span className="text-gradient">o'sing va daromad oling</span>
            </h1>
             <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Sotuvchi, blogger yoki marketplace integratori sifatida ishlang va daromad oling.
            </p>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button size="lg" className="text-lg px-8 py-6" asChild>
                 <Link to="/partner-auth">
                   Hamkor bo'lish
                   <ArrowRight className="ml-2 h-5 w-5" />
                 </Link>
               </Button>
               <Button size="lg" variant="outline" className="text-lg px-8 py-6" asChild>
                 <Link to="/">
                   Marketplace'ni ko'rish
                 </Link>
               </Button>
             </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
                  <stat.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Products */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Biznes modelingizni tanlang</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Ikki yo'nalishdan birini tanlang - yoki ikkalasini ham!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
            {/* SellerCloudX */}
            <Card className="relative overflow-hidden border-2 border-amber-500/30 shadow-xl">
              <div className="absolute top-0 right-0">
                <Badge className="rounded-none rounded-bl-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium
                </Badge>
              </div>
              
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-2xl">SellerCloudX</CardTitle>
                <CardDescription className="text-base">
                  Marketplace avtomatizatsiya platformasi
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <div className="text-4xl font-bold text-primary">$499</div>
                  <div className="text-muted-foreground">/oyiga</div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Uzum, Yandex, Wildberries, Ozon - barcha marketplacelarni bitta 
                  dashboarddan boshqaring. API orqali ulang va savdoni avtomatlashtirig.
                </p>

                <ul className="space-y-2">
                  {[
                    "4 ta marketplace integratsiya",
                    "AI bilan kartochka yaratish",
                    "Markazlashtirilgan buyurtma boshqaruvi",
                    "Zaxira sinxronizatsiyasi",
                    "Narx optimizatsiyasi",
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90" 
                  size="lg"
                  asChild
                >
                   <Link to={user ? '/seller-cloud' : '/partner-auth?role=sellercloud'}>
                    Boshlash
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* BazarHub */}
            <Card className="relative overflow-hidden border-2 shadow-xl">
              <div className="absolute top-0 right-0">
                <Badge className="rounded-none rounded-bl-lg">
                  Mashhur
                </Badge>
              </div>
              
              <CardHeader className="pb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4">
                  <Store className="h-8 w-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">BazarHub Do'koni</CardTitle>
                <CardDescription className="text-base">
                  O'z onlayn do'koningizni yarating
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div>
                  <div className="text-4xl font-bold text-primary">Bepul</div>
                  <div className="text-muted-foreground">boshlash</div>
                </div>

                <p className="text-sm text-muted-foreground">
                  BazarHub marketplace'da o'z do'koningizni oching. 
                  Mahsulotlaringizni qo'shing yoki dropshipping bilan ishlang.
                </p>

                <ul className="space-y-2">
                  {[
                    "Bepul do'kon yaratish",
                    "AI yordamida mahsulot qo'shish",
                    "Dropshipping import",
                    "Buyurtma va moliya boshqaruvi",
                    "3-8% sotuvdan komissiya",
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button className="w-full" size="lg" asChild>
                   <Link to={user ? '/seller-activation' : '/partner-auth?role=seller'}>
                    Bepul boshlash
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Blogger Section */}
          <Card className="max-w-3xl mx-auto">
            <CardContent className="flex flex-col md:flex-row items-center gap-6 py-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-1">Blogger sifatida ishlang</h3>
                <p className="text-muted-foreground">
                  Mahsulotlarni reklama qiling va har bir sotuvdan 10-25% komissiya oling.
                  Shaxsiy referral havolalar va real-time statistika.
                </p>
              </div>
              <Button variant="outline" asChild>
                 <Link to={user ? '/blogger-activation' : '/partner-auth?role=blogger'}>
                  Batafsil
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

       {/* Benefits */}
       <section className="py-24">
        <div className="container mx-auto px-4">
           <div className="grid lg:grid-cols-2 gap-16 items-center">
             <div>
               <Badge variant="outline" className="mb-4">Afzalliklar</Badge>
               <h2 className="text-4xl font-bold mb-6">
                 Nima uchun aynan <span className="text-gradient">biz</span>?
               </h2>
               <p className="text-lg text-muted-foreground mb-8">
                 O'zbekiston bozori uchun maxsus ishlab chiqilgan platforma. 
                 Mahalliy to'lov tizimlari va AI texnologiyalari.
               </p>
               
               <div className="space-y-4">
                 {benefits.map((benefit, index) => (
                   <div 
                     key={index} 
                     className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 transition-all"
                   >
                     <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                       <benefit.icon className="h-6 w-6 text-primary" />
                     </div>
                     <span className="text-foreground font-medium">{benefit.text}</span>
                   </div>
                 ))}
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
               {testimonials.map((testimonial, index) => (
                 <Card key={index} className="border-0 shadow-lg">
                   <CardContent className="pt-6">
                     <div className="flex gap-1 mb-3">
                       {Array.from({ length: testimonial.rating }).map((_, i) => (
                         <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                       ))}
                     </div>
                     <p className="text-sm mb-4 italic">"{testimonial.text}"</p>
                     <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                         <span className="text-primary font-semibold text-xs">{testimonial.name[0]}</span>
                       </div>
                       <div>
                         <div className="font-medium text-sm">{testimonial.name}</div>
                         <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </div>
         </div>
       </section>
 
       {/* How it works */}
       <section className="py-16 bg-muted/30">
         <div className="container mx-auto px-4">
           <div className="text-center mb-12">
             <h2 className="text-3xl font-bold mb-4">Qanday ishlaydi?</h2>
           </div>
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {[
              { step: 1, title: "Ro'yxatdan o'ting", desc: "1 daqiqada bepul hisob yarating" },
              { step: 2, title: "Yo'nalish tanlang", desc: "SellerCloudX yoki BazarHub" },
              { step: 3, title: "Ishni boshlang", desc: "Marketplace ulang yoki do'kon yarating" },
              { step: 4, title: "Daromad oling", desc: "Har bir sotuvdan foyda oling" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
       <section className="py-24 relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
         <div className="absolute inset-0 bg-dot-pattern opacity-10" />
 
         <div className="container mx-auto px-4 relative z-10 text-center">
           <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
             Hoziroq boshlang!
           </h2>
           <p className="text-primary-foreground/80 mb-10 max-w-2xl mx-auto text-lg">
              Minglab sotuvchilar allaqachon biz bilan ishlashmoqda. Navbat sizda!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <Button size="lg" variant="secondary" className="text-lg px-8 py-6" asChild>
                 <Link to="/partner-auth">
                   Hamkor bo'lish
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
               <Button 
                 size="lg" 
                 variant="outline" 
                 className="text-lg px-8 py-6 bg-transparent border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                 asChild
               >
                 <Link to="/">
                  Marketplace'ni ko'rish
                </Link>
              </Button>
            </div>
        </div>
      </section>
    </Layout>
  );
}
