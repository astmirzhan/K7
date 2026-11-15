import type { Metadata, Viewport } from 'next';
import { Jersey_10, Pixelify_Sans } from 'next/font/google';
import './globals.css';

const display = Jersey_10({ variable: '--font-display', weight: '400', subsets: ['latin'] });
const body = Pixelify_Sans({ variable: '--font-body', weight: ['400', '500', '600', '700'], subsets: ['latin'] });

// Absolute base for og:image: the Vercel production domain, else the configured app URL.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'K7 — Your goal is a quest',
  description: "Your goal is a quest. Don't play it alone. Pick 3 goals, find people nearby who want the same, and level up together.",
  openGraph: {
    title: 'K7 — Your goal is a quest',
    description: "Don't play it alone: a quest roadmap for your goals and real people nearby to do it with.",
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#8FA4E7',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
