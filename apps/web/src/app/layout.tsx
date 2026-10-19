import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'NoteNest — Your thoughts, always with you',
    template: '%s | NoteNest',
  },
  description:
    'A fast, simple and powerful note-taking app that works online and offline. Capture your ideas, organize your notes, and stay productive — across all your devices.',
  keywords: ['notes', 'productivity', 'NoteNest', 'tasks', 'offline', 'knowledge management'],
  authors: [{ name: 'NoteNest' }],
  creator: 'NoteNest',
  openGraph: {
    type: 'website',
    title: 'NoteNest — Your thoughts, always with you',
    description: 'A fast, simple and powerful note-taking app that works online and offline.',
    siteName: 'NoteNest',
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
