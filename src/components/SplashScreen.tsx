import { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'logo' | 'bars' | 'exit'>('logo');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Phase 1: Logo appears (0-800ms)
    const t1 = setTimeout(() => setPhase('bars'), 800);
    
    // Phase 2: Progress bars animate (800-2000ms)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 3;
      });
    }, 30);

    // Phase 3: Exit animation
    const t2 = setTimeout(() => setPhase('exit'), duration - 400);
    const t3 = setTimeout(onComplete, duration);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(interval);
    };
  }, [duration, onComplete]);

  return (
    <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-all duration-400 ${
      phase === 'exit' ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
    }`}>
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl animate-pulse" />
      </div>

      {/* Logo */}
      <div className={`relative flex flex-col items-center gap-4 transition-all duration-700 ${
        phase === 'logo' ? 'animate-scale-in' : ''
      }`}>
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Rocket className="h-10 w-10 text-primary-foreground" />
          </div>
          {/* Ring pulse */}
          <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" style={{ animationDuration: '1.5s' }} />
        </div>
        
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">Seller</span>
          <span className="text-foreground">CloudX</span>
        </h1>
      </div>

      {/* Loading bars */}
      <div className={`mt-10 w-64 space-y-3 transition-all duration-500 ${
        phase === 'bars' || phase === 'exit' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <LoadingBar label="Ma'lumotlar" progress={Math.min(progress * 1.3, 100)} delay={0} />
        <LoadingBar label="Marketplace" progress={Math.min(progress * 1.1, 100)} delay={100} />
        <LoadingBar label="Analitika" progress={Math.min(progress * 0.9, 100)} delay={200} />
        
        <p className="text-xs text-muted-foreground text-center mt-4 animate-pulse">
          Tizim yuklanmoqda...
        </p>
      </div>
    </div>
  );
}

function LoadingBar({ label, progress, delay }: { label: string; progress: number; delay: number }) {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!show) return <div className="h-6" />;

  return (
    <div className="space-y-1 animate-fade-in">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-primary font-mono">{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
