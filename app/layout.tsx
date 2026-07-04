import type { Metadata, Viewport } from 'next';
import './globals.css';
import './hifi-app.css';

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
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
