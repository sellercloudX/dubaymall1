import React from "react";
import { ArrowLeft, Download, Chrome, Shield, Zap, BarChart3, Calculator, Settings, CheckCircle2, Globe, TrendingUp, DollarSign, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const features = [
  { icon: BarChart3, title: "Multi-Marketplace Analitika", desc: "Uzum, WB, Yandex seller panellarida bevosita statistika" },
  { icon: DollarSign, title: "Moliya Scraping", desc: "API bermagan komissiya, logistika xarajatlarini DOM orqali olish" },
  { icon: Calculator, title: "Foyda Kalkulyator", desc: "Real-time ROI, marja — har bir marketplace uchun" },
  { icon: Zap, title: "Avtomatik kartochka", desc: "AI yordamida Uzum'da kartochka yaratish" },
  { icon: TrendingUp, title: "Raqobatchi Monitoring", desc: "mpstats.io va zoomselling.io dan trend va narx yig'ish" },
  { icon: Globe, title: "Marketplace Front", desc: "uzum.uz sahifasida mahsulot tahlili va klonlash" },
  { icon: Package, title: "Buyurtmalar Boshqarish", desc: "Seller panellarida buyurtmalarni qayta ishlash" },
  { icon: Shield, title: "Narx Himoyasi", desc: "Seller kabinetlarida DOM orqali narx yangilash" },
];

const steps = [
  "ZIP faylni yuklab oling",
  "ZIP ni oching (Extract/Unzip)",
  "Chrome brauzerda chrome://extensions sahifasini oching",
  "\"Developer mode\" ni yoqing (yuqori o'ng burchak)",
  "\"Load unpacked\" tugmasini bosing",
  "Ochilgan papkani tanlang — tayyor!",
];

export default function ExtensionDownload() {
  const navigate = useNavigate();

  const handleDownload = () => {
    fetch("/sellercloudx-extension.zip")
      .then((res) => {
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sellercloudx-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert("Yuklab olishda xato: " + err.message));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-base font-bold text-foreground">Chrome Extension</h1>
            <p className="text-xs text-muted-foreground">SellerCloudX Multi-Marketplace v4.1.0</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Chrome className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">SellerCloudX Multi-Marketplace Extension v4.1.0</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Uzum, Wildberries, Yandex Market seller panellarida + mpstats.io, zoomselling.io da bevosita analitika, moliya scraping va avtomatlashtirish
          </p>
        </div>

        {/* Download Button */}
        <Button onClick={handleDownload} size="lg" className="w-full gap-2 h-12 text-base">
          <Download className="w-5 h-5" /> Yuklab olish (ZIP)
        </Button>

        {/* Features */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Imkoniyatlar</h3>
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-3 space-y-1.5">
                  <f.icon className="w-5 h-5 text-primary" />
                  <div className="text-xs font-semibold text-foreground">{f.title}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{f.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Install Steps */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">O'rnatish qadamlari</h3>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <span className="text-xs text-foreground">{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compatibility */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-foreground mb-1">Mos brauzerlar</div>
              <div className="text-[10px] text-muted-foreground">
                Google Chrome, Microsoft Edge, Brave, Arc, Opera — barcha Chromium asosidagi brauzerlar bilan ishlaydi
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center pb-8">
          <Button variant="outline" size="sm" onClick={() => navigate(window.innerWidth < 768 ? '/seller-cloud-mobile' : '/seller-cloud')} className="gap-2">
            <Settings className="w-4 h-4" /> Dashboard'ga qaytish
          </Button>
        </div>
      </div>
    </div>
  );
}
