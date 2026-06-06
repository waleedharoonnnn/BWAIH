import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Sidebar } from "@/components/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "AgentTest — Universal AI Agent Testing Framework",
  description: "Test, validate, and score AI agents with deterministic assertions and LLM-as-a-Judge semantic scoring",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans">
        <ThemeProvider>
          <Sidebar />
          <div className="pl-56 min-h-screen">
            <main className="max-w-6xl mx-auto px-5 py-6">
              {children}
            </main>
          </div>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
