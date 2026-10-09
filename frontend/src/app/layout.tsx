import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { AppStreamProvider } from "@/components/providers/AppStreamProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VanGuard | Institutional Paper Trading Terminal",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-screen overflow-hidden bg-background text-foreground font-sans">
        <ThemeProvider>
          <TooltipProvider>
            <AppStreamProvider>
              <div className="flex h-screen overflow-hidden">
                {/* Left Sidebar */}
                <Sidebar />

                {/* Main Application Container */}
                <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
                  <TopHeader />
                  <main className="flex-1 overflow-y-auto px-6 pt-6 pb-6 bg-slate-50 text-slate-900 dark:bg-[#121215] dark:text-white slim-scrollbar">
                    {children}
                  </main>
                </div>

              </div>
            </AppStreamProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
