import { useState } from 'react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      setIsError(true);
      setStatus('Please complete name, email, and message.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');
    setIsError(false);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not send your message right now.');
      }

      setStatus('Thank you. Your message was sent to the admin team.');
      setName('');
      setEmail('');
      setMessage('');
      setIsError(false);
    } catch (error) {
      setIsError(true);
      setStatus(error?.message || 'Could not send your message right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Fast Sport Support</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Contact Fast Sport</h1>
        <p className="mt-3 text-slate-600">Send us a message and the Fast Sport admin team will get back to you.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Message</span>
          <textarea
            rows="6"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-3xl bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Sending...' : 'Send message'}
        </button>
      </form>
      <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-6 text-slate-700">
        <h2 className="text-lg font-semibold mb-2">Fast Sport Contact Details</h2>
        <div className="space-y-1">
          <div><span className="font-medium">Email:</span> <a href="mailto:support@fastsport.co.za" className="text-[#00C5CD] hover:underline">support@fastsport.co.za</a></div>
          <div><span className="font-medium">Tel:</span> <a href="tel:+27824684935" className="text-[#00C5CD] hover:underline">+27 82 468 4935</a></div>
        </div>
      </div>
      {status ? (
        <p className={isError ? 'text-red-600' : 'text-emerald-700'}>{status}</p>
      ) : null}
    </div>
  );
}
