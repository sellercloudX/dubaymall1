import { Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEOHead';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Store, Users, ArrowRight, CheckCircle, 
  Globe, Crown, Star, Shield, Zap, Sparkles
} from 'lucide-react';

export default function Partnership() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const partnershipTypes = [
    {
      id: 'sellercloud',
      title: 'SellerCloudX',
      subtitle: 'Marketplace avtomatizatsiya',
      description: 'Uzum, Yandex, Wildberries, Ozon - barcha marketplacelarni bitta dashboarddan boshqaring.',
      icon: Globe,
      gradient: 'from-amber-500 to-orange-500',
      price: '$499/oy',
      badge: { text: 'Premium', variant: 'premium' as const },
      features: [
        '4 ta marketplace integratsiya',
        'AI bilan kartochka yaratish',
        'Markazlashtirilgan buyurtma boshqaruvi',
        'Zaxira sinxronizatsiyasi',
        'Narx optimizatsiyasi',
      ],
      link: user ? '/seller-cloud' : '/partner-auth?role=sellercloud',
      buttonText: 'Boshlash',
    },
    {
      id: 'seller',
      title: 'Dubay Mall Do\'koni',
      subtitle: 'O\'z onlayn do\'koningiz',
      description: 'Dubay Mall marketplace\'da bepul do\'kon oching. Mahsulotlaringizni qo\'shing yoki dropshipping bilan ishlang.',
      icon: Store,
      gradient: 'from-primary to-primary/80',
      price: 'Bepul',
      badge: { text: 'Mashhur', variant: 'default' as const },
      features: [
        'Bepul do\'kon yaratish',
        'AI yordamida mahsulot qo\'shish',
        'Dropshipping import',
        'Buyurtma va moliya boshqaruvi',
        '3-8% sotuvdan komissiya',
      ],
      link: user ? '/seller-activation' : '/partner-auth?role=seller',
      buttonText: 'Bepul boshlash',
    },
    {
      id: 'blogger',
      title: 'Blogger Dasturi',
      subtitle: 'Affiliate marketing',
      description: 'Mahsulotlarni reklama qiling va har bir sotuvdan 10-25% komissiya oling. Shaxsiy referral havolalar.',
      icon: Users,
      gradient: 'from-purple-500 to-violet-500',
      price: '10-25%',
      badge: { text: 'Daromadli', variant: 'secondary' as const },
      features: [
        'Shaxsiy referral havolalar',
        'Real-time statistika',
        'Yuqori komissiya foizlari',
        'Tez pul yechib olish',
        'AI mahsulot tavsiyalari',
      ],
      link: user ? '/blogger-activation' : '/partner-auth?role=blogger',
      buttonText: 'Batafsil',
    },
  ];

  const benefits = [
    { icon: Shield, text: "Xavfsiz to'lov - Payme, Click, Uzcard" },
    { icon: Globe, text: "3 tilda interfeys - O'zbek, Rus, Ingliz" },
    { icon: Zap, text: "AI yordamchi - mahsulot qo'shish va tahlil" },
    { icon: Star, text: "Professional qo'llab-quvvatlash 24/7" },
  ];

  return (
    <Layout>
      <SEOHead 
        title="Hamkorlik - Dubay Mall" 
        description="Sotuvchi, blogger yoki marketplace integratori sifatida Dubay Mall bilan hamkorlik qiling." 
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
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
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              <span className="text-foreground">O'zingizga mos</span>
              <br />
              <span className="text-gradient">yo'nalishni tanlang</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Sotuvchi, blogger yoki marketplace integratori - qaysi yo'nalish sizga mos kelsa, shu yerdan boshlang.
            </p>
          </div>
        </div>
      </section>

      {/* Partnership Cards */}
      <section className="pb-16 md:pb-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {partnershipTypes.map((type) => (
              <Card 
                key={type.id} 
                className={`relative overflow-hidden border-2 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 ${
                  type.id === 'sellercloud' ? 'border-amber-500/30' : ''
                }`}
              >
                {/* Badge */}
                <div className="absolute top-0 right-0">
                  <Badge 
                    className={`rounded-none rounded-bl-lg ${
                      type.badge.variant === 'premium' 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' 
                        : ''
                    }`}
                    variant={type.badge.variant === 'premium' ? 'default' : type.badge.variant}
                  >
                    {type.id === 'sellercloud' && <Crown className="h-3 w-3 mr-1" />}
                    {type.badge.text}
                  </Badge>
                </div>

                <CardContent className="pt-12 pb-6 px-6 space-y-5">
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${type.gradient} flex items-center justify-center`}>
                    <type.icon className="h-7 w-7 text-white" />
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-xl font-bold">{type.title}</h3>
                    <p className="text-sm text-muted-foreground">{type.subtitle}</p>
                  </div>

                  {/* Price */}
                  <div>
                    <span className={`text-2xl font-bold ${type.id === 'blogger' ? 'text-purple-500' : 'text-primary'}`}>
                      {type.price}
                    </span>
                    {type.id === 'blogger' && <span className="text-sm text-muted-foreground ml-1">komissiya</span>}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground">
                    {type.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {type.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <CheckCircle className={`h-4 w-4 flex-shrink-0 ${
                          type.id === 'sellercloud' ? 'text-amber-500' : 
                          type.id === 'blogger' ? 'text-purple-500' : 'text-primary'
                        }`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Button */}
                  <Button 
                    className={`w-full ${
                      type.id === 'sellercloud' 
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90' 
                        : type.id === 'blogger'
                        ? 'bg-gradient-to-r from-purple-500 to-violet-500 hover:opacity-90'
                        : ''
                    }`}
                    size="lg"
                    asChild
                  >
                    <Link to={type.link}>
                      {type.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Nima uchun aynan biz?</h2>
            <p className="text-muted-foreground">O'zbekiston bozori uchun maxsus ishlab chiqilgan</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <div 
                key={index} 
                className="flex flex-col items-center text-center p-4 rounded-xl bg-background border hover:border-primary/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent" />
        <div className="absolute inset-0 bg-dot-pattern opacity-10" />

        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Hoziroq boshlang!
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Minglab sotuvchilar allaqachon biz bilan ishlashmoqda. Navbat sizda!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-lg px-8" asChild>
              <Link to="/partner-auth">
                Hamkor bo'lish
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 bg-transparent border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
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
