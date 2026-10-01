import { useMemo } from 'react';
import { useAbout } from '@/lib/queries/catalog';
import { toUserMessage } from '@/lib/userMessage';

/**
 * Why: Turns **bold** markers in content text into bold elements without using raw HTML.
 * @param value - The content text.
 * @returns Text and bold nodes.
 * @example
 * renderBoldText('We **ship** fast');
 */
function renderBoldText(value: string | null | undefined) {
  return String(value || '')
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
      }

      return <span key={`text-${index}`}>{part}</span>;
    });
}

/**
 * Why: Public About page, rendering admin-edited content; errors show a friendly sentence via
 * `toUserMessage()`.
 * @returns The About/How-it-works article, or a friendly error message.
 */
export default function About() {
  const aboutQuery = useAbout();
  const content = {
    aboutUsBody: aboutQuery.data?.aboutUsBody || '',
    howItWorksBody: aboutQuery.data?.howItWorksBody || '',
    updatedAt: aboutQuery.data?.updatedAt || null,
  };
  const loading = aboutQuery.isPending;
  const error = aboutQuery.isError
    ? toUserMessage(
        aboutQuery.error,
        "We couldn't load this page's content right now. Please try again.",
      )
    : '';

  const aboutUsParagraphs = useMemo(() => {
    return String(content.aboutUsBody || '')
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [content.aboutUsBody]);

  const howItWorksParagraphs = useMemo(() => {
    return String(content.howItWorksBody || '')
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [content.howItWorksBody]);

  const lastUpdatedLabel = useMemo(() => {
    if (!content.updatedAt) {
      return '';
    }
    const asDate = new Date(content.updatedAt);
    return Number.isNaN(asDate.getTime()) ? '' : asDate.toLocaleString();
  }, [content.updatedAt]);

  if (loading) {
    return <p>Loading article...</p>;
  }

  return (
    <article className="mx-auto max-w-4xl py-4">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">About Fast Sport</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900">Our story</h1>
        {lastUpdatedLabel ? (
          <p className="mt-4 text-xs uppercase tracking-[0.08em] text-slate-500">
            Last updated: {lastUpdatedLabel}
          </p>
        ) : null}
      </header>

      {error ? <p className="mb-6 text-sm text-rose-600">{error}</p> : null}

      <section className="space-y-6 text-[1.05rem] leading-8 text-slate-700">
        <h2 className="text-3xl font-semibold text-slate-900">About us</h2>
        {aboutUsParagraphs.length > 0 ? (
          aboutUsParagraphs.map((paragraph, index) => (
            <p key={`about-us-paragraph-${index}`}>{renderBoldText(paragraph)}</p>
          ))
        ) : (
          <p>About us content will appear here once an admin publishes it.</p>
        )}
      </section>

      <section
        id="how-it-works"
        className="mt-12 scroll-mt-28 space-y-6 text-[1.05rem] leading-8 text-slate-700"
      >
        <h2 className="text-3xl font-semibold text-slate-900">How it works</h2>
        {howItWorksParagraphs.length > 0 ? (
          howItWorksParagraphs.map((paragraph, index) => (
            <p key={`how-it-works-paragraph-${index}`}>{renderBoldText(paragraph)}</p>
          ))
        ) : (
          <p>How it works content will appear here once an admin publishes it.</p>
        )}
      </section>
    </article>
  );
}
