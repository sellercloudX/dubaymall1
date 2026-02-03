import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Store, 
  Users, 
  Package, 
  ArrowRight, 
  CheckCircle, 
  TrendingUp,
  Percent,
  Globe,
  Truck
} from 'lucide-react';

export default function Partnership() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const partnershipOptions = [
    {
      id: 'seller',
      title: "Sotuvchi bo'ling",
      titleRu: "Станьте продавцом",
      titleEn: "Become a Seller",
      description: "O'z mahsulotlaringizni sotib, millionlab xaridorlarga yeting",
      descriptionRu: "Продавайте свои товары миллионам покупателей",
      descriptionEn: "Sell your products to millions of customers",
      icon: Store,
      color: "from-blue-500 to-blue-600",
      features: [
        "Bepul do'kon yaratish",
        "AI yordamida mahsulot qo'shish",
        "Buyurtmalarni boshqarish",
        "Moliyaviy hisobotlar",
      ],
      featuresRu: [
        "Бесплатное создание магазина",
        "Добавление товаров с помощью ИИ",
        "Управление заказами",
        "Финансовые отчеты",
      ],
      featuresEn: [
        "Free shop creation",
        "AI-powered product listing",
        "Order management",
        "Financial reports",
      ],
      link: user ? '/seller' : '/auth?mode=register&role=seller',
      badge: "Mashhur",
      badgeRu: "Популярно",
      badgeEn: "Popular",
    },
    {
      id: 'blogger',
      title: "Blogger sifatida ishlang",
      titleRu: "Работайте как блогер",
      titleEn: "Work as a Blogger",
      description: "Mahsulotlarni reklama qilib, har bir sotuvdan komissiya oling",
      descriptionRu: "Рекламируйте товары и получайте комиссию с каждой продажи",
      descriptionEn: "Promote products and earn commission on every sale",
      icon: Users,
      color: "from-purple-500 to-purple-600",
      features: [
        "10-25% komissiya",
        "Shaxsiy referral havolalar",
        "Real-time statistika",
        "Tez pul yechish",
      ],
      featuresRu: [
        "Комиссия 10-25%",
        "Персональные реферальные ссылки",
        "Статистика в реальном времени",
        "Быстрый вывод средств",
      ],
      featuresEn: [
        "10-25% commission",
        "Personal referral links",
        "Real-time statistics",
        "Fast withdrawals",
      ],
      link: user ? '/blogger' : '/auth?mode=register&role=blogger',
      badge: "Yangi",
      badgeRu: "Новое",
      badgeEn: "New",
    },
    {
      id: 'dropshipping',
      title: "Dropshipping biznes",
      titleRu: "Дропшиппинг бизнес",
      titleEn: "Dropshipping Business",
      description: "Xitoydan import qilib, O'zbekistonda sotib daromad oling",
      descriptionRu: "Импортируйте из Китая и продавайте в Узбекистане",
      descriptionEn: "Import from China and sell in Uzbekistan",
      icon: Globe,
      color: "from-emerald-500 to-emerald-600",
      features: [
        "Havola orqali import",
        "Avtomatik narx belgilash",
        "Omborsiz sotish",
        "Yetkazib beruvchi integratsiyasi",
      ],
      featuresRu: [
        "Импорт по ссылке",
        "Автоматическое ценообразование",
        "Продажа без склада",
        "Интеграция с поставщиками",
      ],
      featuresEn: [
        "Import via URL",
        "Automatic pricing",
        "No warehouse needed",
        "Supplier integration",
      ],
      link: user ? '/seller' : '/auth?mode=register&role=seller',
      badge: null,
    },
  ];

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
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Biz bilan birga o'sing
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              SuperEshop Hub platformasida o'z biznesingizni boshlang. Sotuvchi, blogger yoki dropshipper sifatida ishlang va daromad oling.
            </p>
          </div>
        </div>
        
        {/* Decorative elements */}
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

      {/* Partnership Options */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Hamkorlik turlarini tanlang</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sizga mos yo'nalishni tanlang va bugun boshlang
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {partnershipOptions.map((option) => (
              <Card 
                key={option.id} 
                className="relative overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 group"
              >
                {option.badge && (
                  <Badge className="absolute top-4 right-4 bg-accent text-accent-foreground">
                    {option.badge}
                  </Badge>
                )}
                
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <option.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <CardDescription className="text-base">
                    {option.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm">
                        <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className={`w-full mt-6 bg-gradient-to-r ${option.color} hover:opacity-90`}
                    asChild
                  >
                    <Link to={option.link}>
                      Boshlash
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
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
              { step: 2, title: "Yo'nalish tanlang", desc: "Sotuvchi, blogger yoki dropshipper" },
              { step: 3, title: "Ishni boshlang", desc: "Do'kon yarating yoki reklama qiling" },
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
              Minglab sotuvchilar va bloggerlar allaqachon biz bilan ishlashmoqda. Navbat sizda!
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
