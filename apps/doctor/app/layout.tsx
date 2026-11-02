import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#6D4AFF",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Obiren Doctor Portal",
  description: "Manage your Obiren appointments, availability and professional profile.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${jakarta.variable} ${inter.variable} antialiased`}
    >
      {/* Extensions such as Grammarly inject attributes into <body> before
          hydration; suppress that known mismatch without hiding app errors. */}
      <body suppressHydrationWarning className="min-h-screen bg-[#FBFAFD] text-[#17131D] font-sans">
        {children}
      </body>
    </html>
  );
}
