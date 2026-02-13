import { useState, useEffect } from 'react';
import sellerCloudXLogo from '@/assets/logos/sellercloudx-logo.png';
import uzumLogo from '@/assets/logos/uzum-market.png';
import magnitLogo from '@/assets/logos/magnit.png';
import wbLogo from '@/assets/logos/wildberries.jpg';
import ozonLogo from '@/assets/logos/ozon.png';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const marketplaces = [
  { src: uzumLogo, name: 'Uzum Market' },
  { src: magnitLogo, name: 'Magnit' },
  { src: wbLogo, name: 'Wildberries' },
  { src: ozonLogo, name: 'Ozon' },
];

export function SplashScreen({ onComplete, duration = 3000 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'marketplaces' | 'exit'>('logo');
  const [visibleLogos, setVisibleLogos] = useState(0);

  useEffect(() => {
    // Phase 1: Main logo appears (0-600ms)
    const t1 = setTimeout(() => {
      setPhase('marketplaces');
      // Show marketplace logos one by one
      let count = 0;
      const logoInterval = setInterval(() => {
        count++;
        setVisibleLogos(count);
        if (count >= 4) clearInterval(logoInterval);
      }, 350);
    }, 600);

    // Phase 2: Exit
    const t2 = setTimeout(() => setPhase('exit'), duration - 400);
    const t3 = setTimeout(onComplete, duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [duration, onComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-all duration-500 ${
      phase === 'exit' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
    }`}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
      </div>

      {/* SellerCloudX Logo */}
      <div className={`relative flex flex-col items-center gap-3 transition-all duration-700 ${
        phase === 'logo' ? 'animate-scale-up' : ''
      }`}>
        <img
          src={sellerCloudXLogo}
          alt="SellerCloudX"
          className="w-24 h-24 rounded-2xl shadow-lg shadow-primary/20 object-cover"
        />
        <h1 className="text-2xl font-bold tracking-tight font-display">
          <span className="text-primary">Seller</span>
          <span className="text-foreground">CloudX</span>
        </h1>
      </div>

      {/* Marketplace Logos */}
      <div className="mt-10 flex items-center gap-4">
        {marketplaces.map((mp, i) => (
          <div
            key={mp.name}
            className={`transition-all duration-500 ${
              i < visibleLogos
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-75 translate-y-4'
            }`}
          >
            <img
              src={mp.src}
              alt={mp.name}
              className="w-14 h-14 rounded-xl object-cover shadow-md"
            />
          </div>
        ))}
      </div>

      {/* Text */}
      <p className={`mt-6 text-sm text-muted-foreground transition-all duration-500 ${
        visibleLogos >= 4 ? 'opacity-100' : 'opacity-0'
      }`}>
        Barcha marketplace — bir joyda
      </p>
    </div>
  );
}
