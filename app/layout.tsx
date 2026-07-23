import type { Metadata, Viewport } from 'next';
import { Noto_Serif_SC } from 'next/font/google';
import './globals.css';
import './hifi-app.css';
import './hifi-desktop.css';
import './tasks-ui.css';

const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '育见',
  description: '懂你家孩子的 AI 育儿助手'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={notoSerif.variable}>
      <body className="hifi-desktop-body">{children}</body>
    </html>
  );
}
