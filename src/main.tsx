import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

// PWA: Force clear stale service workers on every new deploy
// This prevents React error #310 caused by old cached JS chunks
if ('serviceWorker' in navigator) {
  const isInIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost =
    window.location.hostname.includes('id-preview--') ||
    window.location.hostname.includes('lovableproject.com');

  if (isPreviewHost || isInIframe) {
    // Unregister all SWs in preview/iframe to prevent cache issues
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  } else {
    // In production: force SW to update immediately if available
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => {
        if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
        r.update().catch(() => {});
      });
    });
  }
}

// Detect Capacitor native environment
if ((window as any).Capacitor) {
  document.documentElement.classList.add('capacitor');
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);