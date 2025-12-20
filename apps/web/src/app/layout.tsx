import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./home.css";
import { ToastProvider, Toaster } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shogi AI Learning",
  description: "Annotate, review, and study shogi with engine-powered insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}>
        <ToastProvider>
          <Toaster />
          <div className="relative z-[1] h-full flex flex-col px-4 sm:px-6 lg:px-12 xl:px-[220px] 2xl:px-[260px] py-6 gap-6">
            <main className="flex-1 w-full min-h-0 flex flex-col">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
