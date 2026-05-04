import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const metadata: Metadata = {
  title: { default: "Inovimmo", template: "%s | Inovimmo" },
  description: "Die Schweizer Immobilienverwaltungsplattform.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Inovimmo" },
};
export const viewport: Viewport = { themeColor: "#1D6EE0" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={inter.variable}>
      <body className="font-sans">{children}<Toaster position="bottom-center" richColors /></body>
    </html>
  );
}
