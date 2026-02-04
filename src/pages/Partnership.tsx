import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Store, Users, ArrowRight, CheckCircle, TrendingUp,
  Percent, Globe, Crown, Package, Truck
} from 'lucide-react';

export default function Partnership() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const stats = [
    { value: "5,000+", label: "Faol sotuvchilar", icon: Store },
    { value: "50,000+", label: "Mahsulotlar", icon: Package },
    { value: "₿ 2M+", label: "Oylik savdo", icon: TrendingUp },
    { value: "25%", label: "O'rtacha komissiya", icon: Percent },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/5 py-16 md:py-24">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20">
              Hamkorlik dasturi
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Biz bilan birga o'sing
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sotuvchi, blogger yoki marketplace integratori sifatida ishlang va daromad oling.
            </p>
          </div>
        </div>
        
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl -z-10" />
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
                  <Link to={user ? '/seller-cloud' : '/auth?redirect=/seller-cloud'}>
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
                  <Link to={user ? '/seller' : '/auth?mode=register&role=seller'}>
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
                <Link to={user ? '/blogger' : '/auth?mode=register&role=blogger'}>
                  Batafsil
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
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
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Tayyor bo'lsangiz, boshlang!</h2>
            <p className="text-muted-foreground mb-8">
              Minglab sotuvchilar allaqachon biz bilan ishlashmoqda. Navbat sizda!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/auth?mode=register">
                  Bepul ro'yxatdan o'tish
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/marketplace">
                  Marketplace'ni ko'rish
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
