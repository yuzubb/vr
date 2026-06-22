import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VRM 同期チェック',
  description: '顔トラッキングとVRMアバターの追従を確認するツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
