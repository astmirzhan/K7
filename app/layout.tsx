import type { Metadata, Viewport } from 'next';
import { Jersey_10, Pixelify_Sans } from 'next/font/google';
import './globals.css';

const display = Jersey_10({ variable: '--font-display', weight: '400', subsets: ['latin'] });
const body = Pixelify_Sans({ variable: '--font-body', weight: ['400', '500', '600', '700'], subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'K7 — Your goal is a quest',
  description: "Your goal is a quest. Don't play it alone.",
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
