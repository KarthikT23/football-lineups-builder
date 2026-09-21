import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Saturday Matchday Football',
  description:
    'Build 5/6/7/8-a-side football lineups for both teams, drag players into position, and export a shareable matchday graphic.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/*
          Plain <link> rather than next/font/google: next/font fetches the font file at
          *build time*, which needs network access to Google's font servers from wherever
          `next build` runs. A <link> fetches it client-side at runtime instead, which is
          more portable across CI environments (including GitHub Actions runners with
          restricted egress) and local machines.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
