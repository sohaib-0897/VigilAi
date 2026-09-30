import './globals.css';
import { Archivo, Geist, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/contexts/auth-context';

// Display: Archivo (variable width axis → condensed/expanded industrial headlines)
// UI:      Geist (neutral, highly legible interface sans)
// Data:    JetBrains Mono (telemetry, coordinates, IDs — tabular figures)
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['wdth'],
  display: 'swap',
});

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'VigilAI — Computer Vision Analytics Platform',
  description: 'Real-time video analytics, tracking, geometry rules, and evidence management',
};

export const viewport = {
  themeColor: '#F2F1EC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${geist.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {/* Light "paper" is the only fully supported theme until the app surfaces
            are migrated to tokens (Stage 7). The optical dark token set exists in
            globals.css; forcing light prevents OS dark mode from half-applying. */}
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
