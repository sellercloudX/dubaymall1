 import React, { Component, ReactNode } from 'react';
 import { Button } from '@/components/ui/button';
 import { AlertTriangle, RefreshCw } from 'lucide-react';
 
 interface Props {
   children: ReactNode;
 }
 
 interface State {
   hasError: boolean;
   error?: Error;
 }
 
 export class ErrorBoundary extends Component<Props, State> {
   constructor(props: Props) {
     super(props);
     this.state = { hasError: false };
   }
 
    static getDerivedStateFromError(error: Error): State {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
    }
 
   handleReset = () => {
     // Clear potentially corrupted cache
     try {
       localStorage.removeItem('sellercloud-cache');
     } catch {}
     window.location.reload();
   };
 
   render() {
     if (this.state.hasError) {
       return (
         <div className="min-h-screen flex items-center justify-center bg-background p-4">
           <div className="max-w-md text-center space-y-4">
             <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
             <h1 className="text-xl font-semibold">Xatolik yuz berdi</h1>
             <p className="text-muted-foreground text-sm">
               Sahifa yuklanishida muammo. Iltimos, sahifani yangilang.
             </p>
             <Button onClick={this.handleReset} className="gap-2">
               <RefreshCw className="h-4 w-4" />
               Sahifani yangilash
             </Button>
           </div>
         </div>
       );
     }
 
     return this.props.children;
   }
 }