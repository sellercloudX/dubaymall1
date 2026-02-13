import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  product?: {
    price?: number;
    currency?: string;
    availability?: 'in_stock' | 'out_of_stock';
    brand?: string;
  };
}

export function SEOHead({
  title = "SellerCloudX — Marketplace Automation Platform",
  description = "Manage Uzum, Yandex Market, Wildberries, Ozon from one dashboard. AI card generation, PnL analytics, price optimization.",
  image = "/og-image.png",
  url,
  type = 'website',
  product,
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper to update or create meta tag
    const setMetaTag = (property: string, content: string, isName = false) => {
      const attribute = isName ? 'name' : 'property';
      let element = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    setMetaTag('description', description, true);
    setMetaTag('robots', 'index, follow', true);

    // Open Graph tags
    setMetaTag('og:title', title);
    setMetaTag('og:description', description);
    setMetaTag('og:image', image);
    setMetaTag('og:type', type);
    if (url) setMetaTag('og:url', url);
    setMetaTag('og:site_name', 'SellerCloudX');
    setMetaTag('og:locale', 'uz_UZ');

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image', true);
    setMetaTag('twitter:title', title, true);
    setMetaTag('twitter:description', description, true);
    setMetaTag('twitter:image', image, true);

    // Product-specific meta (for e-commerce)
    if (type === 'product' && product) {
      if (product.price) {
        setMetaTag('product:price:amount', product.price.toString());
        setMetaTag('product:price:currency', product.currency || 'UZS');
      }
      if (product.availability) {
        setMetaTag('product:availability', product.availability);
      }
      if (product.brand) {
        setMetaTag('product:brand', product.brand);
      }
    }

    // Cleanup function
    return () => {
      // Reset to default title when component unmounts
      document.title = "SellerCloudX — Marketplace Automation Platform";
    };
  }, [title, description, image, url, type, product]);

  return null;
}

// JSON-LD structured data component
interface StructuredDataProps {
  type: 'Organization' | 'Product' | 'BreadcrumbList' | 'WebSite';
  data: Record<string, unknown>;
}

export function StructuredData({ type, data }: StructuredDataProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': type,
      ...data,
    });
    script.id = `structured-data-${type.toLowerCase()}`;
    
    // Remove existing script with same id
    const existing = document.getElementById(script.id);
    if (existing) existing.remove();
    
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(script.id);
      if (scriptToRemove) scriptToRemove.remove();
    };
  }, [type, data]);

  return null;
}
