import { useEffect, useMemo, useState } from 'react';
import { fetchAboutContent } from '../lib/firestoreHelpers';

export default function About() {
  const [content, setContent] = useState({
    aboutUsBody: '',
    howItWorksBody: '',
    updatedAt: null,
    updatedBy: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    fetchAboutContent()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setContent({
          aboutUsBody: data?.aboutUsBody || '',
          howItWorksBody: data?.howItWorksBody || '',
          updatedAt: data?.updatedAt || null,
          updatedBy: data?.updatedBy || '',
        });
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not load article content right now.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    const value = content.updatedAt;
    if (!value) {
      return '';
    }

    let asDate = null;
    if (typeof value?.toDate === 'function') {
      asDate = value.toDate();
    } else if (typeof value?.seconds === 'number') {
      asDate = new Date(value.seconds * 1000);
    } else if (value instanceof Date) {
      asDate = value;
    }

    if (!asDate || Number.isNaN(asDate.getTime())) {
      return '';
    }

    return asDate.toLocaleString();
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
            Last updated: {lastUpdatedLabel}{content.updatedBy ? ` by ${content.updatedBy}` : ''}
          </p>
        ) : null}
      </header>

      {error ? <p className="mb-6 text-sm text-rose-600">{error}</p> : null}

      <section className="space-y-6 text-[1.05rem] leading-8 text-slate-700">
        <h2 className="text-3xl font-semibold text-slate-900">About us</h2>
        {aboutUsParagraphs.length > 0 ? (
          aboutUsParagraphs.map((paragraph, index) => (
            <p key={`about-us-paragraph-${index}`}>{paragraph}</p>
          ))
        ) : (
          <p>About us content will appear here once an admin publishes it.</p>
        )}
      </section>

      <section className="mt-12 space-y-6 text-[1.05rem] leading-8 text-slate-700">
        <h2 className="text-3xl font-semibold text-slate-900">How it works</h2>
        {howItWorksParagraphs.length > 0 ? (
          howItWorksParagraphs.map((paragraph, index) => (
            <p key={`how-it-works-paragraph-${index}`}>{paragraph}</p>
          ))
        ) : (
          <p>How it works content will appear here once an admin publishes it.</p>
        )}
      </section>
    </article>
  );
}
