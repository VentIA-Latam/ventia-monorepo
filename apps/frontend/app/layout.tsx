import type { Metadata } from "next";
import "./globals.css";
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "./providers";

// Google Fonts
import { Plus_Jakarta_Sans, Libre_Franklin, Source_Sans_3, JetBrains_Mono } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
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

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Ventia - Latam | Vendemos y entregamos por ti.",
  description: "Landing VentIA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${plusJakarta.variable} ${libre.variable} ${sourceSans.variable} ${jetbrainsMono.variable} font-sans`}
        suppressHydrationWarning
      >
        <Auth0Provider>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </Auth0Provider>
      </body>
    </html>
  );
}

