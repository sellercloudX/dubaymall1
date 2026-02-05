import { ReactNode, lazy, Suspense } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BottomNavigation } from '@/components/mobile/BottomNavigation';

// Lazy load heavy components for better performance
const AIChat = lazy(() => import('@/components/chat/AIChat').then(m => ({ default: m.AIChat })));

interface LayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />
      {/* Extra padding on mobile to avoid bottom nav overlap */}
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      {/* Hide footer on mobile to prevent overlap with bottom nav */}
      {showFooter && <Footer />}
      <Suspense fallback={null}>
        <AIChat />
      </Suspense>
      <BottomNavigation />
    </div>
  );
}
