import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#6D4AFF",
  width: "device-width",
  initialScale: 1,
};

/**
 * Internal console only. The public site, including its metadata and social
 * cards, lives in `apps/web`; this app must never be indexed or previewed.
 */
export const metadata: Metadata = {
  title: "Obiren Admin",
  description: "Internal Obiren operations console.",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${inter.variable} scroll-smooth antialiased`}
    >
      <body className="min-h-screen bg-white text-[#171717] font-sans selection:bg-[#E8DFFF] selection:text-[#6D4AFF]">
        {children}
      </body>
    </html>
  );
}
