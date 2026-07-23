import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Obiren Admin Control Centre | Central Operational Command",
  description: "Central role-based operational management system for Obiren platform across UK, US, Nigeria, and Ghana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-[#E8E0FF] selection:text-[#6C4CF1]">
        {children}
      </body>
    </html>
  );
}
