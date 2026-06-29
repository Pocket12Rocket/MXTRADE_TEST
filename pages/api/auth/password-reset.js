import nodemailer from 'nodemailer';
import admin from '../../../lib/firebaseAdmin';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSiteBaseUrl(req) {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || '').trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const host = req.headers.host || 'fastsport.co.za';
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : (forwardedProto || 'https');
  return `${proto}://${host}`;
}

async function sendEmail({ to, subject, html }) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const fromEmail = (process.env.CONTACT_FROM_EMAIL || 'FastSport <noreply@fastsport.co.za>').trim();

  if (!to) {
    return;
  }

  if (resendApiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
    });

    if (response.ok) {
      return;
    }

    const errorBody = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${errorBody}`);
  }

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      html,
    });
    return;
  }

  throw new Error('No email transport is configured. Set RESEND_API_KEY or SMTP_USER/SMTP_PASS.');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'Please enter your email address.' });
  }

  try {
    const siteBaseUrl = getSiteBaseUrl(req);
    const resetLink = await admin.auth().generatePasswordResetLink(email, {
      url: `${siteBaseUrl}/login`,
      handleCodeInApp: false,
    });

    const subject = 'Reset your FastSport password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">Reset your FastSport password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your FastSport account.</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 20px; background-color: #00C5CD; color: #ffffff; text-decoration: none; border-radius: 999px; margin: 8px 0 12px;">
            Reset password
          </a>
        </p>
        <p>If the button above does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #334155;">${escapeHtml(resetLink)}</p>
        <p>If you did not request this change, you can safely ignore this email.</p>
        <p style="margin-top: 20px;">Thanks,<br/>FastSport Team</p>
      </div>
    `;

    await sendEmail({ to: email, subject, html });
    return res.status(200).json({ message: 'Password reset email sent.' });
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    if (code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    console.error('[Password Reset] Failed to send reset email', error);
    return res.status(500).json({ message: 'We could not send the password reset email right now. Please try again later.' });
  }
}
