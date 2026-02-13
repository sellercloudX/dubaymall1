import { Link } from 'react-router-dom';
import { Crown, Send, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  return (
    <footer className="border-t bg-card hidden md:block">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold font-display">SellerCloudX</span>
              <p className="text-xs text-muted-foreground">Marketplace automation platform</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="https://t.me/sellercloudx" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Send className="h-3.5 w-3.5" /> Telegram
            </a>
            <span>info@sellercloudx.com</span>
          </div>

          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SellerCloudX. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}