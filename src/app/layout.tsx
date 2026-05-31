import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'

const spaceGrotesk = localFont({
  src: [
    { path: '../../public/static/fonts/SpaceGrotesk-Light.ttf', weight: '300', style: 'normal' },
    { path: '../../public/static/fonts/SpaceGrotesk-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/static/fonts/SpaceGrotesk-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/static/fonts/SpaceGrotesk-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../../public/static/fonts/SpaceGrotesk-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Rung Chuông Vàng',
  description: 'Mini Game Rung Chuông Vàng',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning className={spaceGrotesk.variable}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  )
}
