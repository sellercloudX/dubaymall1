import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/Layout';
import { SEOHead, StructuredData } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Store, 
  Sparkles, 
  Package, 
  Users, 
  ArrowRight, 
  CheckCircle, 
  ShoppingBag,
  Truck,
  Shield,
  Star,
  Zap,
  Globe
} from 'lucide-react';

export default function Index() {
  const { t } = useLanguage();

  const organizationData = {
    name: 'Dubay Mall',
    url: 'https://dubaymall.uz',
    logo: 'https://dubaymall.uz/logo.png',
    description: "O'zbekistonning eng yirik onlayn savdo platformasi",
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'UZ',
      addressLocality: 'Toshkent',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['uz', 'ru', 'en'],
    },
  };

  const websiteData = {
    name: 'Dubay Mall',
    url: 'https://dubaymall.uz',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://dubaymall.uz/marketplace?search={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  const features = [
    {
      icon: Store,
      title: t.feature1Title,
      description: t.feature1Desc,
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      icon: Sparkles,
      title: t.feature2Title,
      description: t.feature2Desc,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Package,
      title: t.feature3Title,
      description: t.feature3Desc,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: Users,
      title: t.feature4Title,
      description: t.feature4Desc,
      gradient: 'from-orange-500 to-red-500',
    },
  ];

  const stats = [
    { value: "10K+", label: "Faol xaridorlar", icon: Users },
    { value: "5K+", label: "Sotuvchilar", icon: Store },
    { value: "50K+", label: "Mahsulotlar", icon: Package },
    { value: "99%", label: "Qoniqish darajasi", icon: Star },
  ];

  const benefits = [
    { icon: Shield, text: "Xavfsiz to'lov - Payme, Click, Uzcard" },
    { icon: Globe, text: "3 tilda interfeys - O'zbek, Rus, Ingliz" },
    { icon: Truck, text: "Tez yetkazib berish - O'zbekiston bo'ylab" },
    { icon: Zap, text: "AI tavsiyalar - Sizga mos mahsulotlar" },
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
    {
      name: "Nilufar Rahimova",
      role: "Xaridor",
      text: "Sifatli mahsulotlar, tez yetkazib berish. Doim shu yerdan xarid qilaman.",
      rating: 5,
    },
  ];

  return (
    <Layout>
      <SEOHead 
        title="Dubay Mall - O'zbekiston onlayn bozori"
        description="O'zbekistonning eng yirik onlayn savdo platformasi. Minglab mahsulotlar, ishonchli sotuvchilar va tez yetkazib berish."
      />
      <StructuredData type="Organization" data={organizationData} />
      <StructuredData type="WebSite" data={websiteData} />

      {/* Hero Section - Premium Fintech */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Background layers - Optimized */}
        <div className="absolute inset-0 bg-mesh" />
        <div className="absolute inset-0 bg-dot-pattern opacity-[0.02]" />
        
        {/* Simplified gradient orbs for performance */}
        <div className="absolute top-20 left-[10%] w-64 h-64 bg-primary/15 rounded-full blur-3xl" style={{ willChange: 'auto' }} />
        <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-r from-primary/8 to-accent/8 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex animate-fade-up">
              <Badge className="mb-8 px-5 py-2.5 text-sm font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors backdrop-blur-sm">
                <Sparkles className="h-4 w-4 mr-2 animate-bounce-subtle" />
                #1 E-commerce platforma O'zbekistonda
              </Badge>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 animate-fade-up font-display" style={{ animationDelay: '0.1s' }}>
              <span className="text-foreground">Sotish oson,</span>
              <br />
              <span className="text-gradient">Sotib olish qulay</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto animate-fade-up leading-relaxed" style={{ animationDelay: '0.2s' }}>
              Minglab mahsulotlar, ishonchli sotuvchilar va AI bilan quvvatlangan xarid tajribasi
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Button size="lg" className="text-lg px-8 py-6 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all btn-glow group" asChild>
                <Link to="/">
                  <ShoppingBag className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Xarid qilish
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 glass hover:bg-primary/5 transition-all group" asChild>
                <Link to="/partnership">
                  Hamkorlik
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            {/* Quick stats */}
            <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              {stats.map((stat, i) => (
                <div key={i} className="group text-center p-5 rounded-2xl glass-card hover:border-primary/30 transition-all hover:-translate-y-1">
                  <stat.icon className="h-6 w-6 mx-auto mb-3 text-primary group-hover:scale-110 transition-transform" />
                  <div className="text-2xl md:text-3xl font-bold text-foreground font-display">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-subtle">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-2.5 rounded-full bg-muted-foreground/50 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Imkoniyatlar</Badge>
            <h2 className="text-4xl font-bold mb-4">{t.features}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Zamonaviy texnologiyalar bilan quvvatlangan to'liq e-commerce yechimi
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-card overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
            <Badge variant="outline" className="mb-4">Afzalliklar</Badge>
              <h2 className="text-4xl font-bold mb-6">
                Nima uchun aynan <span className="text-gradient">Dubay Mall</span>?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                O'zbekiston bozori uchun maxsus ishlab chiqilgan platforma. Mahalliy to'lov tizimlari, tez yetkazib berish va AI texnologiyalari.
              </p>
              
              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl" />
              <div className="relative grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-card shadow-xl border">
                    <Store className="h-10 w-10 text-primary mb-3" />
                    <div className="text-3xl font-bold">5,000+</div>
                    <div className="text-muted-foreground">Faol do'konlar</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-card shadow-xl border">
                    <Package className="h-10 w-10 text-success mb-3" />
                    <div className="text-3xl font-bold">50K+</div>
                    <div className="text-muted-foreground">Mahsulotlar</div>
                  </div>
                </div>
                <div className="space-y-4 mt-8">
                  <div className="p-6 rounded-2xl bg-card shadow-xl border">
                    <Users className="h-10 w-10 text-accent mb-3" />
                    <div className="text-3xl font-bold">10K+</div>
                    <div className="text-muted-foreground">Xaridorlar</div>
                  </div>
                  <div className="p-6 rounded-2xl bg-card shadow-xl border">
                    <Star className="h-10 w-10 text-accent mb-3" />
                    <div className="text-3xl font-bold">4.9</div>
                    <div className="text-muted-foreground">O'rtacha reyting</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">Fikrlar</Badge>
            <h2 className="text-4xl font-bold mb-4">Foydalanuvchilar nima deydi?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-accent text-accent" />
                    ))}
                  </div>
                  <p className="text-foreground mb-6 italic">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">{testimonial.name[0]}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
        <div className="absolute inset-0 bg-dot-pattern opacity-10" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Hoziroq boshlang!
          </h2>
          <p className="text-primary-foreground/80 mb-10 max-w-2xl mx-auto text-lg">
            Bir necha daqiqada professional do'koningizni yarating yoki blogger sifatida daromad olishni boshlang
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8 py-6 shadow-xl" asChild>
              <Link to="/auth?mode=register">
                Bepul ro'yxatdan o'tish
                <ArrowRight className="ml-2 h-5 w-5" />
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
