import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';

const TITLE = 'InternIndex: find open internships, track every application';
const DESCRIPTION =
  'Aggregates open internship listings from company job boards and community feeds, filters them by everything that matters to a student, and tracks your applications end to end.';

/**
 * Absolute origin for the share card and canonical URLs. Preview deployments set
 * their own host, so the Vercel-provided one wins over the production domain
 * whenever this is not the real site.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://internindex.online');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'InternIndex',
  // The share card: a 1200x630 PNG rendered from scripts/og-image.html. It is a
  // committed asset rather than a generated route so a crawler that refuses to
  // wait, or fetches before the app is warm, still gets a thumbnail.
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'InternIndex',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'InternIndex: internships that are actually open, listed by field and tracked end to end.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og.png'],
  },
  icons: {
    // .ico first with sizes="any" so SVG-capable browsers still prefer the vector.
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

/**
 * Applies the saved theme before first paint so a dark-mode user never sees a
 * white flash. Kept inline and tiny for exactly that reason.
 *
 * The legacy key is still read so the rename does not reset anyone's theme.
 */
const themeBootstrap = `
(function () {
  try {
    var saved = localStorage.getItem('internindex-theme') || localStorage.getItem('internfinder-theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Nav />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
