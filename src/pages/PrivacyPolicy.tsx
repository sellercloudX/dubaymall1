import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base font-bold text-foreground">Privacy Policy</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 prose prose-sm dark:prose-invert">
        <h1>Privacy Policy — SellerCloudX Extension</h1>
        <p className="text-muted-foreground">Last updated: April 4, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          SellerCloudX ("we", "our", "us") operates the SellerCloudX Chrome Extension
          ("Extension"). This Privacy Policy explains how we collect, use, and protect
          information when you use our Extension.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>2.1 Account Information</h3>
        <p>
          When you log in to the Extension, we store your email address and authentication
          token locally in Chrome storage to maintain your session.
        </p>

        <h3>2.2 Marketplace Data</h3>
        <p>
          The Extension reads publicly visible data from marketplace seller panels
          (Uzum, Wildberries, Yandex Market) that you are already logged into. This includes:
        </p>
        <ul>
          <li>Product listings, prices, and stock levels</li>
          <li>Order information and statuses</li>
          <li>Financial reports and commission data</li>
          <li>Analytics and performance metrics</li>
        </ul>
        <p>
          This data is transmitted to our secure servers only with your explicit consent
          and is used solely to provide you with analytics and management features
          within the SellerCloudX dashboard.
        </p>

        <h3>2.3 No Personal Browsing Data</h3>
        <p>
          We do <strong>not</strong> collect your browsing history, keystrokes, passwords,
          or any data from websites other than the supported marketplace platforms listed
          in our manifest.
        </p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Synchronize your marketplace data with the SellerCloudX dashboard</li>
          <li>Provide analytics, profit calculations, and business insights</li>
          <li>Execute marketplace actions (product creation, price updates) on your behalf</li>
          <li>Send notifications about orders, stock levels, and price changes</li>
        </ul>

        <h2>4. Data Storage & Security</h2>
        <p>
          Your authentication credentials are stored locally in Chrome's encrypted storage.
          Marketplace data transmitted to our servers is encrypted in transit (TLS 1.3)
          and at rest. We use Supabase Row Level Security (RLS) to ensure your data
          is only accessible to your account.
        </p>

        <h2>5. Data Sharing</h2>
        <p>
          We do <strong>not</strong> sell, trade, or share your data with third parties.
          Your marketplace data is only accessible to you through your SellerCloudX account.
        </p>

        <h2>6. Permissions Explained</h2>
        <table>
          <thead>
            <tr><th>Permission</th><th>Purpose</th></tr>
          </thead>
          <tbody>
            <tr><td><code>activeTab</code></td><td>Read marketplace page content on supported sites</td></tr>
            <tr><td><code>storage</code></td><td>Store your login session and settings locally</td></tr>
            <tr><td><code>alarms</code></td><td>Periodic sync and connection keep-alive</td></tr>
            <tr><td><code>notifications</code></td><td>Alert you about orders and stock changes</td></tr>
            <tr><td><code>tabs</code></td><td>Detect if marketplace tabs are open</td></tr>
            <tr><td><code>scripting</code></td><td>Inject analytics overlays on marketplace pages</td></tr>
          </tbody>
        </table>

        <h2>7. Your Rights</h2>
        <ul>
          <li>You can log out and clear all local data at any time via the Extension popup</li>
          <li>You can request deletion of your server-side data by contacting us</li>
          <li>You can uninstall the Extension at any time to stop all data collection</li>
        </ul>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          significant changes through the Extension or our website.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at{" "}
          <a href="mailto:support@sellercloudx.com" className="text-primary">
            support@sellercloudx.com
          </a>
        </p>
      </div>
    </div>
  );
}
