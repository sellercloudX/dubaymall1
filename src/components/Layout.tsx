import { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { BottomNavigation } from '@/components/mobile/BottomNavigation';

interface LayoutProps {
  children: ReactNode;
  showFooter?: boolean;
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      {showFooter && <Footer />}
      <BottomNavigation />
    </div>
  );
}
