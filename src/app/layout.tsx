import type { Metadata, Viewport } from "next";
import { appPath } from "@/lib/app-path";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppFinanza",
  description: "Administración financiera personal y familiar compartida.",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
  applicationName: "AppFinanza",
  appleWebApp: { capable: true, title: "AppFinanza", statusBarStyle: "default" },
  icons: { icon: appPath("/icon-192.png"), apple: appPath("/icon-192.png") },
};

export const viewport: Viewport = { themeColor: "#12324a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es-CO"><body><PwaRegister />{children}</body></html>;
}
