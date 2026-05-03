import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Inovimmo", template: "%s | Inovimmo" },
  description: "Die Schweizer Immobilienverwaltungsplattform — kostenlos, sicher, vollintegriert.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Inovimmo" },
};

export const viewport: Viewport = {
  themeColor: "#1D6EE0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
