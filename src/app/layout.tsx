import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast-provider";
import { UserProvider } from "@/components/user-provider";

export const metadata: Metadata = {
  title: {
    default: "DMB Compliance — Smart Screening APU-PPT & DTTOT",
    template: "%s · DMB Compliance",
  },
  description:
    "Platform smart screening APU-PPT, DTTOT, dan anti-terorisme untuk pialang berjangka. Sesuai POJK No. 8 Tahun 2023 dan standar pelaporan PPATK.",
  applicationName: "DMB Compliance Suite",
  authors: [{ name: "PT Didi Max Berjangka" }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061725",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ToastProvider>
          <UserProvider>
            <AppShell>{children}</AppShell>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
