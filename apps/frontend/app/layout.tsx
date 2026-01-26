import type { Metadata } from "next";
import "./globals.css";
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import { Toaster } from "@/components/ui/toaster";

// Google Fonts
import { Inter, Libre_Franklin, Source_Sans_3 } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const libre = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-libre-franklin",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--font-source-sans",
});

export const metadata: Metadata = {
  title: "Ventia - Latam | Vendemos y entregamos por ti.",
  description: "Landing VentIA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${libre.variable} ${sourceSans.variable} font-sans`}
        suppressHydrationWarning
      >
        <Auth0Provider>
          {children}
          <Toaster />
        </Auth0Provider>
      </body>
    </html>
  );
}
