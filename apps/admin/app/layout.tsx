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
  title: "Obiren — Health. Safety. Peace of Mind.",
  description:
    "Obiren is your all-in-one women's health companion. Track your cycle, monitor pregnancy, consult verified gynecologists, access emergency support, and stay connected to your trusted circle.",
  keywords: [
    "women health app",
    "period tracker",
    "pregnancy tracker",
    "gynecologist consultation",
    "women safety app",
    "silent SOS",
    "trusted circle location",
    "health vault",
    "Obiren",
    "Nigeria women health",
    "Ghana women health",
    "UK women health",
    "US women health",
  ],
  authors: [{ name: "Obiren Health Inc." }],
  openGraph: {
    title: "Obiren — Health. Safety. Peace of Mind.",
    description:
      "The smarter way to care for your health and safety. Join the early access waitlist today.",
    url: "https://obiren.com",
    siteName: "Obiren",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Obiren — Health. Safety. Peace of Mind.",
    description:
      "All-in-one women's health, wellness, and safety platform launching soon in UK, US, Nigeria, and Ghana.",
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
