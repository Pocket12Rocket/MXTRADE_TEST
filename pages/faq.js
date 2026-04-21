const faqs = [
  {
    question: 'How do sellers submit products?',
    answer: 'Sellers log in, create a profile, and submit products through the seller dashboard. Submissions remain pending until approved by an admin.',
  },
  {
    question: 'Can customers pay online?',
    answer: 'Yes, the architecture is built for PayFast / Fayfast integration. The checkout route is a placeholder until gateway credentials are configured.',
  },
  {
    question: 'What happens after approval?',
    answer: 'Once an admin approves a submission, it is published as a live product and becomes visible in the shop catalog.',
  },
];

export default function FAQ() {
  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">FAQ</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Frequently asked questions</h1>
      </div>
      <div className="space-y-4">
        {faqs.map((item) => (
          <div key={item.question} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">{item.question}</h2>
            <p className="mt-2 text-slate-600">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
