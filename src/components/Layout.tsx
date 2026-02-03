import { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { AIChat } from '@/components/chat/AIChat';
import { BottomNavigation } from '@/components/mobile/BottomNavigation';

interface LayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      {showFooter && <Footer />}
      <AIChat />
      <BottomNavigation />
    </div>
  );
}
