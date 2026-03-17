import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminStats } from '@/components/admin/AdminStats';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminFinancials } from '@/components/admin/AdminFinancials';
import { UsersManagement } from '@/components/admin/UsersManagement';
import { SellerCloudManagement } from '@/components/admin/SellerCloudManagement';
import { ActivationsManagement } from '@/components/admin/ActivationsManagement';
import { AdminsManagement } from '@/components/admin/AdminsManagement';
import { StartupMetrics } from '@/components/admin/StartupMetrics';
import { PlatformExpenses } from '@/components/admin/PlatformExpenses';
import { PartnerAnalytics } from '@/components/admin/PartnerAnalytics';
import { AIAgentDashboard } from '@/components/admin/AIAgentDashboard';
import { AdminSupportChat } from '@/components/admin/AdminSupportChat';
import { FeaturePricingManagement } from '@/components/admin/FeaturePricingManagement';
import { TutorialVideosAdmin } from '@/components/admin/TutorialVideosAdmin';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { Shield, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

// Mobile-only: tab-based fallback (unchanged from before)
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layout } from '@/components/Layout';
import {
  TrendingUp, BarChart3, UsersRound, Users, UserCheck,
  Wallet, Zap, Settings, Bot, MessageCircle, Crown, DollarSign, BookOpen,
} from 'lucide-react';

const pageTitles: Record<string, string> = {
  metrics: 'Dashboard',
  analytics: 'Analitika',
  partners: 'Hamkorlar',
  users: 'Foydalanuvchilar',
  activations: 'Aktivatsiya',
  chat: 'Support Chat',
  finance: 'Daromad',
  sellercloud: 'SellerCloudX',
  pricing: 'Narxlar & Balans',
  expenses: 'Xarajatlar',
  admins: 'Adminlar boshqaruvi',
  'ai-agent': 'AI Agent Dashboard',
  tutorials: 'Qo\'llanmalar boshqaruvi',
};

function AdminContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'metrics': return <StartupMetrics />;
    case 'analytics': return <AdminAnalytics />;
    case 'partners': return <PartnerAnalytics />;
    case 'users': return <UsersManagement />;
    case 'activations': return <ActivationsManagement />;
    case 'chat': return <AdminSupportChat />;
    case 'finance': return <AdminFinancials />;
    case 'sellercloud': return <SellerCloudManagement />;
    case 'pricing': return <FeaturePricingManagement />;
    case 'expenses': return <PlatformExpenses />;
    case 'admins': return <AdminsManagement />;
    case 'ai-agent': return <AIAgentDashboard />;
    case 'tutorials': return <TutorialVideosAdmin />;
    default: return <StartupMetrics />;
  }
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { permissions, isLoading: permissionsLoading, hasPermission, isSuperAdmin } = useAdminPermissions();
  const [activeTab, setActiveTab] = useState('metrics');

  useEffect(() => {
    if (!loading && !permissionsLoading && !user) {
      navigate('/auth');
    }
  }, [user, loading, permissionsLoading, navigate]);

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!permissions) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Ruxsat yo'q</h1>
          <p className="text-muted-foreground">Bu sahifaga faqat adminlar kira oladi.</p>
          <Button variant="outline" onClick={() => navigate('/')}>Bosh sahifa</Button>
        </div>
      </div>
    );
  }

  // ─── DESKTOP: Sidebar layout ───
  const desktopView = (
    <div className="hidden md:flex min-h-screen bg-background">
      <AdminSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasPermission={(p) => hasPermission(p as any)}
        isSuperAdmin={isSuperAdmin}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{pageTitles[activeTab] || 'Admin'}</h1>
            <p className="text-xs text-muted-foreground">SellerCloudX boshqaruv markazi</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {isSuperAdmin ? '👑 Super Admin' : '🔒 Admin'}
            </span>
          </div>
        </header>

        {/* Stats bar (only on dashboard) */}
        {activeTab === 'metrics' && hasPermission('can_manage_finances') && (
          <div className="px-6 pt-6">
            <AdminStats />
          </div>
        )}

        {/* Main content area */}
        <main className="flex-1 p-6 overflow-auto">
          <AdminContent activeTab={activeTab} />
        </main>
      </div>

      {/* Floating chat button */}
      {activeTab !== 'chat' && hasPermission('can_manage_users') && (
        <button
          onClick={() => setActiveTab('chat')}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );

  // ─── MOBILE: Original tab layout (unchanged) ───
  const mobileView = (
    <div className="md:hidden">
      <Layout>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">
                {isSuperAdmin ? 'Super Admin Panel' : 'Admin Panel'}
              </h1>
              <p className="text-muted-foreground">SellerCloudX boshqaruv markazi</p>
            </div>
          </div>

          {hasPermission('can_manage_finances') && (
            <div className="mb-8"><AdminStats /></div>
          )}

          <Tabs defaultValue="metrics" className="space-y-6">
            <TabsList className="h-auto flex-wrap gap-1 p-1">
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="metrics" className="gap-1.5 text-xs">
                  <TrendingUp className="h-3.5 w-3.5" />Metrikalar
                </TabsTrigger>
              )}
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="analytics" className="gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5" />Analitika
                </TabsTrigger>
              )}
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="partners" className="gap-1.5 text-xs">
                  <UsersRound className="h-3.5 w-3.5" />Hamkorlar
                </TabsTrigger>
              )}
              {hasPermission('can_manage_users') && (
                <TabsTrigger value="users" className="gap-1.5 text-xs">
                  <Users className="h-3.5 w-3.5" />Foydalanuvchilar
                </TabsTrigger>
              )}
              {hasPermission('can_manage_activations') && (
                <TabsTrigger value="activations" className="gap-1.5 text-xs">
                  <UserCheck className="h-3.5 w-3.5" />Aktivatsiya
                </TabsTrigger>
              )}
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="finance" className="gap-1.5 text-xs">
                  <Wallet className="h-3.5 w-3.5" />Moliya
                </TabsTrigger>
              )}
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="expenses" className="gap-1.5 text-xs">
                  <Zap className="h-3.5 w-3.5" />Xarajatlar
                </TabsTrigger>
              )}
              {isSuperAdmin && (
                <TabsTrigger value="admins" className="gap-1.5 text-xs">
                  <Settings className="h-3.5 w-3.5" />Adminlar
                </TabsTrigger>
              )}
              {isSuperAdmin && (
                <TabsTrigger value="ai-agent" className="gap-1.5 text-xs">
                  <Bot className="h-3.5 w-3.5" />AI Agent
                </TabsTrigger>
              )}
              {hasPermission('can_manage_users') && (
               <TabsTrigger value="chat" className="gap-1.5 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" />Chat
                </TabsTrigger>
              )}
              {hasPermission('can_manage_finances') && (
                <TabsTrigger value="pricing" className="gap-1.5 text-xs">
                  <DollarSign className="h-3.5 w-3.5" />Narxlar
                </TabsTrigger>
              )}
              {hasPermission('can_manage_content') && (
                <TabsTrigger value="tutorials" className="gap-1.5 text-xs">
                  <BookOpen className="h-3.5 w-3.5" />Qo'llanma
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="metrics"><StartupMetrics /></TabsContent>
            <TabsContent value="analytics"><AdminAnalytics /></TabsContent>
            <TabsContent value="partners"><PartnerAnalytics /></TabsContent>
            <TabsContent value="users"><UsersManagement /></TabsContent>
            <TabsContent value="activations"><ActivationsManagement /></TabsContent>
            <TabsContent value="finance">
              <Tabs defaultValue="financials" className="space-y-4">
                <TabsList className="h-auto gap-1 p-1">
                  <TabsTrigger value="financials" className="text-xs gap-1"><Wallet className="h-3.5 w-3.5" />Daromad</TabsTrigger>
                  <TabsTrigger value="sellercloud" className="text-xs gap-1"><Crown className="h-3.5 w-3.5" />SellerCloudX</TabsTrigger>
                </TabsList>
                <TabsContent value="financials"><AdminFinancials /></TabsContent>
                <TabsContent value="sellercloud"><SellerCloudManagement /></TabsContent>
              </Tabs>
            </TabsContent>
            <TabsContent value="expenses"><PlatformExpenses /></TabsContent>
            <TabsContent value="admins"><AdminsManagement /></TabsContent>
            <TabsContent value="ai-agent"><AIAgentDashboard /></TabsContent>
            <TabsContent value="chat"><AdminSupportChat /></TabsContent>
            <TabsContent value="pricing"><FeaturePricingManagement /></TabsContent>
            <TabsContent value="tutorials"><TutorialVideosAdmin /></TabsContent>
          </Tabs>
        </div>
      </Layout>
    </div>
  );

  return (
    <>
      {desktopView}
      {mobileView}
    </>
  );
}
