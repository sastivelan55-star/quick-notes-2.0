import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LifeMap OS — Your life. Your goals. In sync.',
    template: '%s | LifeMap OS',
  },
  description:
    'The intelligent operating system designed to turn your long-term ambitions into daily momentum. Connect your goals, tasks, and weekly reviews seamlessly.',
  keywords: ['LifeMap OS', 'productivity', 'goals', 'tasks', 'roadmap', 'offline', 'Supabase'],
  authors: [{ name: 'LifeMap OS' }],
  creator: 'LifeMap OS',
  openGraph: {
    type: 'website',
    title: 'LifeMap OS — Your life. Your goals. In sync.',
    description: 'The intelligent operating system designed to turn your long-term ambitions into daily momentum.',
    siteName: 'LifeMap OS',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0c0b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('flownote-app-state');
                  var theme = stored ? JSON.parse(stored).state?.theme : 'system';
                  var resolved = theme === 'system'
                    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                    : theme;
                  document.documentElement.setAttribute('data-theme', resolved || 'light');
                } catch(e) {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
