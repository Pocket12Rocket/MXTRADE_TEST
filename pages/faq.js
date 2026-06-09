
import { useEffect, useState } from 'react';
import { fetchFaqs } from '../lib/firestoreHelpers';

export default function FAQ() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFaqs()
      .then(setFaqs)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Fast Sport FAQ</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Fast Sport Frequently Asked Questions</h1>
      </div>
      <div className="space-y-4">
        {loading ? (
          <p>Loading FAQs...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : faqs.length === 0 ? (
          <p className="text-slate-600">No FAQs found.</p>
        ) : (
          faqs.map((item) => (
            <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{item.question}</h2>
              <p className="mt-2 text-slate-600">{item.answer}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
