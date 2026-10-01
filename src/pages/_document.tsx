import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Why: Custom HTML document. `data-scroll-behavior="smooth"` tells Next 16 that the smooth
 * scrolling in `styles/globals.css` is intentional, so it switches it off during route
 * transitions (new pages start at the top instantly) instead of warning.
 * @returns The HTML document shell.
 * @example
 * // Used automatically by Next.js for every page.
 */
export default function Document() {
  return (
    <Html lang="en" data-scroll-behavior="smooth">
      <Head>
        <meta name="facebook-domain-verification" content="xw6ihohnf332c8rmdnq5552w00tyf2" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
