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
     // Check if cache structure is valid
     if (!parsed || typeof parsed !== 'object' || !parsed.clientState) {
       localStorage.removeItem('sellercloud-cache');
     }
   }
 } catch {
   localStorage.removeItem('sellercloud-cache');
 }

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { PageLoader } from "@/components/PageLoader";
import { InstallPWA } from "@/components/InstallPWA";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
 const PartnerAuth = lazy(() => import("./pages/PartnerAuth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const SellerCloudX = lazy(() => import("./pages/SellerCloudX"));
const SellerCloudMobile = lazy(() => import("./pages/SellerCloudMobile"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const ShopPage = lazy(() => import("./pages/ShopPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const BloggerDashboard = lazy(() => import("./pages/BloggerDashboard"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const Partnership = lazy(() => import("./pages/Partnership"));
 const NotFound = lazy(() => import("./pages/NotFound"));
 const SellerActivation = lazy(() => import("./pages/SellerActivation"));
 const BloggerActivation = lazy(() => import("./pages/BloggerActivation"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

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
        staleTime: 1000 * 60 * 2, // 2 minutes - fresher data
        gcTime: 1000 * 60 * 60 * 24, // 24 hours for offline
        refetchOnWindowFocus: false,
        refetchOnReconnect: true, // Refetch when back online
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  }));

   // Listen for online/offline status
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
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
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
                    <Route path="/" element={<Marketplace />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/partner-auth" element={<PartnerAuth />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/seller" element={<SellerDashboard />} />
                    <Route path="/seller-cloud" element={<SellerCloudX />} />
                    <Route path="/seller-cloud-mobile" element={<SellerCloudMobile />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/shop/:slug" element={<ShopPage />} />
                    <Route path="/product/:id" element={<ProductPage />} />
                    <Route path="/cart" element={<CartPage />} />
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/blogger" element={<BloggerDashboard />} />
                    <Route path="/favorites" element={<FavoritesPage />} />
                    <Route path="/partnership" element={<Partnership />} />
                    <Route path="/seller-activation" element={<SellerActivation />} />
                    <Route path="/blogger-activation" element={<BloggerActivation />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
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
