import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LOKAI',
  description: 'AI-powered exam preparation for Lok Sewa & competitive exams',
  applicationName: 'LOKAI',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'LOKAI' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#185FA5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
