import nodemailer from 'nodemailer';
import admin, { adminDb } from '../../../lib/firebaseAdmin';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildAdminRecipients() {
  const supportEmail = 'support@fastsport.co.za';
  const adminEmailsCsv = process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || '';
  const singleAdmin = process.env.CONTACT_ADMIN_EMAIL || '';

  const parsed = adminEmailsCsv
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set([supportEmail, ...parsed, ...(singleAdmin ? [singleAdmin] : [])].filter(Boolean)));
}

async function fetchAdminEmailsFromUsers() {
  const [lowerRoleSnapshot, titleRoleSnapshot, upperRoleSnapshot] = await Promise.all([
    adminDb.collection('users').where('role', '==', 'admin').get(),
    adminDb.collection('users').where('role', '==', 'Admin').get(),
    adminDb.collection('users').where('role', '==', 'ADMIN').get(),
  ]);

  const adminDocsByUid = new Map();
  [lowerRoleSnapshot, titleRoleSnapshot, upperRoleSnapshot].forEach((snapshot) => {
    snapshot.docs.forEach((docItem) => {
      adminDocsByUid.set(docItem.id, docItem.data() || {});
    });
  });

  if (adminDocsByUid.size === 0) {
    return [];
  }

  const emails = [];
  const missingEmailUids = [];

  adminDocsByUid.forEach((data, uid) => {
    const email = String(data?.email || '').trim();
    if (email) {
      emails.push(email);
      return;
    }
    missingEmailUids.push(uid);
  });

  if (missingEmailUids.length > 0) {
    const lookedUpEmails = await Promise.all(
      missingEmailUids.map(async (uid) => {
        try {
          const userRecord = await admin.auth().getUser(uid);
          return String(userRecord?.email || '').trim();
        } catch {
          return '';
        }
      })
    );

    lookedUpEmails.forEach((email) => {
      if (email) {
        emails.push(email);
      }
    });
  }

  return Array.from(new Set(emails));
}

async function buildAdminRecipientsFromDatabaseAndEnv() {
  const supportEmail = 'support@fastsport.co.za';
  const configuredRecipients = buildAdminRecipients();
  const adminEmails = await fetchAdminEmailsFromUsers();
  return Array.from(new Set([supportEmail, ...adminEmails, ...configuredRecipients].filter(Boolean)));
}

async function sendEmail({ to, subject, html }) {
  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  const fromEmail = 'Fast Sport <support@fastsport.co.za>';
  const fromAddress = 'support@fastsport.co.za';

  if (!to || to.length === 0) {
    return;
  }

  if (resendApiKey) {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to,
        subject,
        html,
      }),
    });

    if (resendResponse.ok) {
      return;
    }

    const resendError = await resendResponse.text();
    console.error('[Submission Notifications] Resend failed', {
      status: resendResponse.status,
      body: resendError,
      to,
      subject,
    });
  }

  if (smtpUser && smtpPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: fromEmail,
      sender: fromAddress,
      replyTo: fromAddress,
      to,
      subject,
      html,
    });
    return;
  }

  throw new Error('No working email transport configured. Set RESEND_API_KEY or SMTP_USER/SMTP_PASS.');
}

function getBearerToken(req) {
  const rawHeader = req.headers.authorization || '';
  if (!rawHeader.startsWith('Bearer ')) {
    return '';
  }
  return rawHeader.slice('Bearer '.length).trim();
}

function getProductLink(siteUrl, productId) {
  if (!productId) {
    return `${siteUrl}/shop`;
  }
  return `${siteUrl}/product/${encodeURIComponent(productId)}`;
}

async function getUserRole(uid) {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  return userDoc.exists ? (userDoc.data()?.role || '') : '';
}

async function getSubmission(submissionId) {
  const submissionDoc = await adminDb.collection('productSubmissions').doc(submissionId).get();
  if (!submissionDoc.exists) {
    return null;
  }
  return { id: submissionDoc.id, ...submissionDoc.data() };
}

async function handleSubmissionCreated({ actorUid, submission }) {
  if (submission.sellerId !== actorUid) {
    throw new Error('Forbidden: seller does not match submission owner.');
  }

  const recipients = await buildAdminRecipientsFromDatabaseAndEnv();
  if (recipients.length === 0) {
    console.warn('[Submission Notifications] Admin notification skipped: no recipient configured');
    return;
  }

  const submittedAt = submission.createdAt?.toDate?.() || new Date();
  const subject = 'New Product Listing';
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="margin:0 0 8px;color:#0f172a">New Product Submission Requires Attention</h2>
      <p style="margin:0 0 16px;color:#64748b">A seller listed a new product for moderation.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 0;color:#64748b;width:120px">Submission ID</td><td style="padding:6px 0"><code>${escapeHtml(submission.id)}</code></td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Product</td><td style="padding:6px 0">${escapeHtml(submission.name || 'Untitled product')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Category</td><td style="padding:6px 0">${escapeHtml(submission.category || 'Uncategorized')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Seller</td><td style="padding:6px 0">${escapeHtml(submission.sellerEmail || submission.sellerId || 'Unknown seller')}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Submitted</td><td style="padding:6px 0">${escapeHtml(submittedAt.toISOString())}</td></tr>
      </table>
      <p style="margin-top:18px">
        <a href="${escapeHtml((process.env.NEXT_PUBLIC_SITE_URL || 'https://fastsport.co.za').trim())}/admin/dashboard" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">Open Admin Dashboard</a>
      </p>
    </div>
  `;

  await sendEmail({ to: recipients, subject, html });
}

async function handleSubmissionApproved({ submission, productId }) {
  const sellerEmail = (submission.sellerEmail || '').trim();
  if (!sellerEmail) {
    console.warn('[Submission Notifications] Approval email skipped: missing sellerEmail', { submissionId: submission.id });
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fastsport.co.za').trim();
  const productUrl = getProductLink(siteUrl, productId || submission.productId || '');
  const subject = `Your Product Was Approved: ${submission.name || 'Untitled product'}`;
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="margin:0 0 8px;color:#0f172a">Your product has been approved</h2>
      <p style="margin:0 0 14px;color:#374151">Your product listing has been approved by an admin and is now live in the store.</p>
      <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(submission.name || 'Untitled product')}</p>
      <p style="margin:0 0 16px"><strong>Status:</strong> Approved</p>
      <p style="margin:0 0 16px"><strong>Category:</strong> ${escapeHtml(submission.category || 'Uncategorized')}</p>
      <p style="margin:0 0 16px">
        <a href="${escapeHtml(productUrl)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">View Product in Store</a>
      </p>
      <p style="margin:0;color:#64748b;font-size:13px">If you cannot open the product directly, visit <a href="${escapeHtml(siteUrl)}/shop" style="color:#0f766e">the store</a>.</p>
    </div>
  `;

  await sendEmail({ to: [sellerEmail], subject, html });
}

async function handleSubmissionRejected({ submission, rejectionReason }) {
  const sellerEmail = (submission.sellerEmail || '').trim();
  if (!sellerEmail) {
    console.warn('[Submission Notifications] Rejection email skipped: missing sellerEmail', { submissionId: submission.id });
    return;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fastsport.co.za').trim();
  const listingsUrl = `${siteUrl}/seller/submissions`;
  const reasonText = (rejectionReason || submission.rejectionReason || 'No reason provided.').trim();
  const subject = `Your Product Was Rejected: ${submission.name || 'Untitled product'}`;
  const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
      <h2 style="margin:0 0 8px;color:#7f1d1d">Your product submission was rejected</h2>
      <p style="margin:0 0 14px;color:#374151">An admin reviewed your product listing and rejected it. Please review the feedback below, update the listing, and resubmit it.</p>
      <p style="margin:0 0 8px"><strong>Product:</strong> ${escapeHtml(submission.name || 'Untitled product')}</p>
      <p style="margin:0 0 8px"><strong>Status:</strong> Rejected</p>
      <p style="margin:0 0 8px"><strong>Category:</strong> ${escapeHtml(submission.category || 'Uncategorized')}</p>
      <p style="margin:0 0 16px"><strong>Admin feedback:</strong><br/>${escapeHtml(reasonText)}</p>
      <p style="margin:0 0 16px">
        <a href="${escapeHtml(listingsUrl)}" style="display:inline-block;background:#7f1d1d;color:#ffffff;text-decoration:none;padding:10px 14px;border-radius:8px">View My Listings</a>
      </p>
    </div>
  `;

  await sendEmail({ to: [sellerEmail], subject, html });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { eventType, submissionId, productId, rejectionReason } = req.body || {};
  if (!eventType || !submissionId) {
    return res.status(400).json({ error: 'eventType and submissionId are required.' });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const role = await getUserRole(decoded.uid);
    const submission = await getSubmission(submissionId);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }

    if (eventType === 'submission_created') {
      await handleSubmissionCreated({ actorUid: decoded.uid, submission });
      return res.status(200).json({ success: true });
    }

    if (eventType === 'submission_approved') {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
      }

      await handleSubmissionApproved({ submission, productId });
      return res.status(200).json({ success: true });
    }

    if (eventType === 'submission_rejected') {
      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
      }

      await handleSubmissionRejected({ submission, rejectionReason });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown event type.' });
  } catch (error) {
    console.error('[Submission Notifications] Handler error', {
      eventType,
      submissionId,
      message: error?.message,
    });

    return res.status(500).json({ error: 'Failed to process submission notification.' });
  }
}
