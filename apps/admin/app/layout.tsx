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

export const metadata: Metadata = {
  title: "Obiren | Health. Safety. Peace of Mind.",
  description:
    "Nigeria's integrated telegynecology, reproductive-health and women's safety platform. Speak privately with qualified professionals, track your cycle, follow your pregnancy and access personal safety tools through one connected experience.",
  keywords: [
    "women health app",
    "telegynecology",
    "period tracker",
    "pregnancy tracker",
    "gynecologist consultation",
    "women safety app",
    "silent SOS",
    "health vault",
    "Obiren",
    "Nigeria women health",
  ],
  authors: [{ name: "Obiren" }],
  openGraph: {
    title: "Obiren | Health. Safety. Peace of Mind.",
    description:
      "Nigeria's integrated telegynecology, reproductive-health and women's safety platform.",
    url: "https://obiren.com",
    siteName: "Obiren",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Obiren | Health. Safety. Peace of Mind.",
    description:
      "Nigeria's integrated telegynecology, reproductive-health and women's safety platform.",
  },
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
