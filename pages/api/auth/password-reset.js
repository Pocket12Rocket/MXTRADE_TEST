import nodemailer from 'nodemailer';
import crypto from 'crypto';

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

function getAllowedRedirectUrl(req) {
  const configured = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '').trim();
  if (configured) {
    return `https://${configured}/login`;
  }

  return `${getSiteBaseUrl(req)}/login`;
}

const resetRequestCooldownMs = 3 * 60 * 1000;
const resetRequestCooldowns = new Map();

function getResetThrottleKey(req, email) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : (typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : '');

  return `${ip || req.socket?.remoteAddress || 'unknown'}:${email}`;
}

function isResetRequestThrottled(req, email) {
  const key = getResetThrottleKey(req, email);
  const now = Date.now();
  const lastAttempt = resetRequestCooldowns.get(key);

  if (lastAttempt && now - lastAttempt < resetRequestCooldownMs) {
    return true;
  }

  resetRequestCooldowns.set(key, now);
  return false;
}

async function sendEmail({ to, subject, html, text }) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 0);
  const smtpSecure = (process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const fromEmail = (process.env.CONTACT_FROM_EMAIL || 'FastSport <support@fastsport.co.za>').trim();
  const replyToEmail = (process.env.CONTACT_REPLY_TO_EMAIL || process.env.CONTACT_FROM_EMAIL || 'support@fastsport.co.za').trim();

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
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        reply_to: replyToEmail,
        subject,
        html,
        ...(text ? { text } : {}),
        headers: {
          'List-Unsubscribe': '<mailto:support@fastsport.co.za?subject=Unsubscribe>',
        },
      }),
    });

    if (response.ok) {
      return;
    }

    const errorBody = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${errorBody}`);
  }

  if (smtpHost && smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(smtpPort) && smtpPort > 0 ? smtpPort : 587,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      requireTLS: true,
    });

    await transporter.sendMail({
      from: fromEmail,
      replyTo: replyToEmail,
      to,
      subject,
      html,
      text,
      headers: {
        'List-Unsubscribe': '<mailto:support@fastsport.co.za?subject=Unsubscribe>',
      },
    });
    return;
  }

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromEmail,
      replyTo: replyToEmail,
      to,
      subject,
      html,
      text,
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

  if (isResetRequestThrottled(req, email)) {
    return res.status(429).json({
      message: 'Too many password reset requests were sent recently. Please wait a few minutes before trying again.',
      detail: 'Reset requests are temporarily throttled for this account.',
    });
  }

  try {
    const redirectUrl = getAllowedRedirectUrl(req);

    const token = crypto.randomBytes(32).toString('hex');
    const actionLink = `${redirectUrl}?resetToken=${token}&email=${encodeURIComponent(email)}`;

    const subject = 'Reset your FastSport password';
    const text = `Hello,\n\nWe received a request to reset the password for your FastSport account.\n\nFollow this link to reset your FastSport password for your account:\n${actionLink}\n\nIf you did not request this change, you can safely ignore this email.\n\nThanks,\nFastSport Team`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
        <h2 style="margin-bottom: 12px; color: #0f172a;">Reset your FastSport password</h2>
        <p>Hello,</p>
        <p>We received a request to reset the password for your FastSport account.</p>
        <p>
          <a href="${actionLink}" style="display: inline-block; padding: 12px 20px; background-color: #00C5CD; color: #ffffff; text-decoration: none; border-radius: 999px; margin: 8px 0 12px;">
            Reset password
          </a>
        </p>
        <p>If the button above does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #334155;">${escapeHtml(actionLink)}</p>
        <p>If you did not request this change, you can safely ignore this email.</p>
        <p style="margin-top: 20px;">Thanks,<br/>FastSport Team</p>
      </div>
    `;

    await sendEmail({ to: email, subject, html, text });
    return res.status(200).json({ message: 'Password reset email sent.' });
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/user-not-found') {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    if (code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (code === 'auth/too-many-requests' || String(error?.message || '').includes('auth/too-many-requests')) {
      return res.status(429).json({
        message: 'Too many password reset requests were sent recently. Please wait a few minutes before trying again.',
        detail: 'Firebase: Error (auth/too-many-requests).',
      });
    }

    console.error('[Password Reset] Failed to send reset email', error);
    const detail = error?.message || error?.code || 'Unknown error';
    const isSmtpAuthFailure = /invalid login|535-5\.7\.8|badcredentials|username and password not accepted/i.test(String(detail));

    if (isSmtpAuthFailure) {
      return res.status(500).json({
        message: 'Google Workspace rejected the SMTP credentials for the password reset mail. Please generate a fresh app password for support@fastsport.co.za and update SMTP_PASS.',
        detail,
      });
    }

    return res.status(500).json({
      message: 'We could not send the password reset email right now. Please try again later.',
      detail,
    });
  }
}
