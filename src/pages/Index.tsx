import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Sparkles, Package, Users, ArrowRight, CheckCircle } from 'lucide-react';

export default function Index() {
  const { t } = useLanguage();

  const features = [
    {
      icon: Store,
      title: t.feature1Title,
      description: t.feature1Desc,
    },
    {
      icon: Sparkles,
      title: t.feature2Title,
      description: t.feature2Desc,
    },
    {
      icon: Package,
      title: t.feature3Title,
      description: t.feature3Desc,
    },
    {
      icon: Users,
      title: t.feature4Title,
      description: t.feature4Desc,
    },
  ];

  const benefits = [
    'Payme, Click, Uzcard to\'lov tizimlari',
    'O\'zbek, Rus, Ingliz tillari',
    'Mobile-first dizayn',
    'AI mahsulot tavsiyalari',
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              {t.heroTitle}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              {t.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="gap-2">
                <Link to="/auth?mode=register">
                  {t.getStarted}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/marketplace">{t.learnMore}</Link>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-72 h-72 bg-accent/10 rounded-full blur-3xl -z-10" />
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">{t.features}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">O'zbekiston bozori uchun</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/20 animate-slide-in" style={{ animationDelay: `${index * 100}ms` }}>
                  <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">
            Hoziroq boshlang!
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Bir necha daqiqada professional do'koningizni yarating va O'zbekiston bo'ylab sotishni boshlang
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/auth?mode=register">
              Bepul ro'yxatdan o'tish
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
