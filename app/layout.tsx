import type { Metadata, Viewport } from 'next';
import { Inter, Press_Start_2P } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const pixel = Press_Start_2P({ variable: '--font-pixel', weight: '400', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'K7 — Your goal is a quest',
  description: 'Turn any goal into a quest with people near you.',
};

export const viewport: Viewport = {
  themeColor: '#1b5e20',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pixel.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
