import React, { useState, Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
 import { QueryClient } from "@tanstack/react-query";
 import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
 import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

 // Clear corrupted cache on startup
 try {
   const cached = localStorage.getItem('sellercloud-cache');
   if (cached) {
     const parsed = JSON.parse(cached);
     if (!parsed || typeof parsed !== 'object' || !parsed.clientState) {
       localStorage.removeItem('sellercloud-cache');
     }
   }
 } catch {
   localStorage.removeItem('sellercloud-cache');
 }

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { PageLoader } from "@/components/PageLoader";
import { InstallPWA } from "@/components/InstallPWA";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const SellerCloudX = lazy(() => import("./pages/SellerCloudX"));
const SellerCloudMobile = lazy(() => import("./pages/SellerCloudMobile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

 // Create persister for offline cache
 const persister = createSyncStoragePersister({
   storage: window.localStorage,
   key: 'sellercloud-cache',
   throttleTime: 1000,
 });
 
function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 60 * 24,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  }));

   useEffect(() => {
     const handleOnline = () => {
       queryClient.invalidateQueries();
     };
     window.addEventListener('online', handleOnline);
     return () => window.removeEventListener('online', handleOnline);
   }, [queryClient]);
 
  return (
    <PersistQueryClientProvider 
      client={queryClient} 
      persistOptions={{ 
        persister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: 'v1',
      }}
    >
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <InstallPWA />
              <BrowserRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/seller-cloud" element={<SellerCloudX />} />
                    <Route path="/seller-cloud-mobile" element={<SellerCloudMobile />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    {/* Redirect old routes to landing */}
                    <Route path="/partnership" element={<Navigate to="/" replace />} />
                    <Route path="/seller" element={<Navigate to="/seller-cloud" replace />} />
                    <Route path="/blogger" element={<Navigate to="/" replace />} />
                    <Route path="/dashboard" element={<Navigate to="/seller-cloud" replace />} />
                    <Route path="/marketplace" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </PersistQueryClientProvider>
  );
}

export default App;