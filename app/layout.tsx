import type { Metadata } from 'next';
import { Fira_Sans, Fira_Sans_Condensed, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

// adesso Corporate Typography
const firaSans = Fira_Sans({
  variable: '--font-fira-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

const firaSansCondensed = Fira_Sans_Condensed({
  variable: '--font-fira-condensed',
  subsets: ['latin'],
  weight: ['600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Dealhunter - AI-powered BD Platform',
  description: 'AI-gestützte BD-Entscheidungsplattform für adesso SE',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* DNS prefetch and preconnect for external API domain */}
        <link rel="dns-prefetch" href="https://adesso-ai-hub.3asabc.de" />
        <link rel="preconnect" href="https://adesso-ai-hub.3asabc.de" />
      </head>
      <body
        className={`${firaSans.variable} ${firaSansCondensed.variable} ${jetBrainsMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
