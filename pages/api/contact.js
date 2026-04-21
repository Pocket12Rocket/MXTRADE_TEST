function parseAdminEmails() {
  const csvValue = process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || '';
  const singleValue = process.env.CONTACT_ADMIN_EMAIL || '';

  const parsedCsv = csvValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const fallback = singleValue.trim() ? [singleValue.trim()] : [];
  return Array.from(new Set(parsedCsv.length ? parsedCsv : fallback));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || 'MXTrade Contact <onboarding@resend.dev>';
  const toEmails = parseAdminEmails();

  if (!resendApiKey) {
    return res.status(500).json({ error: 'Missing RESEND_API_KEY server configuration.' });
  }

  if (!toEmails.length) {
    return res.status(500).json({ error: 'Missing admin recipient email configuration.' });
  }

  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const message = String(req.body?.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  const html = `
    <h2>New Contact Form Message</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmails,
        reply_to: email,
        subject: `MXTrade contact form: ${name}`,
        html,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(500).json({ error: payload?.message || 'Failed to send contact email.' });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to send contact email.' });
  }
}
