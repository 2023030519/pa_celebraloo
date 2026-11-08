import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { themeFrom } from "@/lib/theme";
import "./globals.css";

// Inter autoalojada por next/font: la cara de interfaz del contrato de dirección.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { template: "%s · Celebraloo Admin", default: "Celebraloo Admin" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = themeFrom((await cookies()).get("theme")?.value);
  return (
    <html lang="es" className={inter.variable} data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-dvh font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
