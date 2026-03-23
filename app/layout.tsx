/**
 * Root Layout
 * @description Top-level layout that wraps every page in the application.
 * Configures Geist font families, global CSS, theme/auth providers,
 * skip-links for accessibility, and the floating theme toggle button.
 * @module app/layout
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SkipLinks } from "@/components/skip-links";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Global metadata for the application */
export const metadata: Metadata = {
  title: "ChainLinked - LinkedIn Content Management",
  description: "Create, schedule, and analyze your LinkedIn content with AI-powered tools",
  icons: {
    icon: "/favicon.ico",
    apple: "/logo-icon.png",
  },
};

/**
 * Root layout component that wraps all pages
 * @param props - Layout props
 * @param props.children - Child page/layout content
 * @returns Root HTML document with providers and global UI elements
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SkipLinks />
        <Providers>
          {children}
          <AnimatedThemeToggler
            className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-background shadow-xl hover:bg-accent transition-colors cursor-pointer [&_svg]:h-5 [&_svg]:w-5"
            aria-label="Toggle theme"
          />
        </Providers>
      </body>
    </html>
  );
}
