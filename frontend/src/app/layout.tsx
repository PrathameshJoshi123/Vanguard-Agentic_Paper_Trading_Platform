import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { AppStreamProvider } from "@/components/providers/AppStreamProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SYRUS-7 | Institutional Paper Trading Terminal",
  description:
    "Production-Grade Indian Equity Paper Trading Engine with Real-Time L2 Market Depth and Agentic Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-slate-50 text-slate-900 font-sans">
        <TooltipProvider>
          <AppStreamProvider>
            {/* Left Sidebar */}
            <Sidebar />

            {/* Main Application Container */}
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
              <TopHeader />
              <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
                {children}
              </main>
            </div>
          </AppStreamProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
