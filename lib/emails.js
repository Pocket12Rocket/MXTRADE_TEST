import nodemailer from 'nodemailer';

export function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || 'support@fastsport.co.za').trim();
const DEFAULT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || `Fast Sports <${SUPPORT_EMAIL}>`;

function getAdminRecipients() {
  const adminEmailsCsv = process.env.CONTACT_ADMIN_EMAILS || process.env.ADMIN_NOTIFICATION_EMAILS || '';
  const singleAdmin = process.env.CONTACT_ADMIN_EMAIL || '';
  const parsed = adminEmailsCsv.split(',').map((e) => e.trim()).filter(Boolean);
  return Array.from(new Set([SUPPORT_EMAIL, ...parsed, ...(singleAdmin ? [singleAdmin] : [])].filter(Boolean)));
}

// Sends an email via Resend, falling back to SMTP; best-effort, never throws.
export async function dispatchEmail({ to, subject, html, from = DEFAULT_FROM_EMAIL, context = '' }) {
  const label = context ? `[Email ${context}]` : '[Email]';
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!toList.length) {
    console.warn(`${label} Skipped: no recipients configured`);
    return false;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: toList, subject, html }),
      });
      if (response.ok) {
        console.log(`${label} Sent via Resend`, { to: toList, subject });
        return true;
      }
      console.error(`${label} Resend failed`, { status: response.status, body: await response.text(), to: toList });
    } catch (err) {
      console.error(`${label} Resend error`, err.message);
    }
  }

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: smtpUser, pass: smtpPass } });
      await transporter.sendMail({ from: smtpUser, to: toList, subject, html });
      console.log(`${label} Sent via SMTP`, { to: toList, subject });
      return true;
    } catch (err) {
      console.error(`${label} SMTP error`, err.message, { to: toList });
    }
  }

  console.warn(`${label} No working transport configured`, {
    hasResendApiKey: Boolean(resendApiKey),
    hasSmtpUser: Boolean(smtpUser),
    to: toList,
  });
  return false;
}

function getShippingLines(order) {
  const shipping = order.shippingAddress || {};
  return [
    [shipping.firstName, shipping.lastName].filter(Boolean).join(' '),
    shipping.streetAddress,
    shipping.suburb,
    shipping.city,
    shipping.province,
    shipping.postalCode,
    shipping.phone ? `Tel: ${shipping.phone}` : null,
  ].filter(Boolean);
}

// "New order confirmed" notice sent to support/admins when payment completes.
export function buildAdminNewOrderEmail({ order, sellerMap = {} }) {
  const shipping = order.shippingAddress || {};
  const shippingLine = [
    shipping.streetAddress,
    shipping.suburb,
    shipping.city,
    shipping.province,
    shipping.postalCode,
  ].filter(Boolean).join(', ');

  const itemRows = (order.items || []).map((item) => {
    const seller = sellerMap[item.sellerId] || {};
    return `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 8px">${escapeHtml(item.name)}</td>
        <td style="padding:10px 8px">R${Number(item.price).toFixed(2)}</td>
        <td style="padding:10px 8px">${Number(item.quantity)}</td>
        <td style="padding:10px 8px">R${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
        <td style="padding:10px 8px">${escapeHtml(seller.displayName || seller.email || item.sellerId || '—')}</td>
      </tr>`;
  }).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <h2 style="color:#00CED1;margin-bottom:4px">New Order — Payment Confirmed</h2>
      <p style="color:#64748b;font-size:13px">Order ID: <code>${escapeHtml(order.id)}</code></p>

      <h3 style="margin-top:24px">Buyer details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 8px;color:#64748b;width:140px">Name</td><td style="padding:6px 8px">${escapeHtml(`${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Email</td><td style="padding:6px 8px">${escapeHtml(order.buyerEmail || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Phone</td><td style="padding:6px 8px">${escapeHtml(shipping.phone || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Shipping</td><td style="padding:6px 8px">${escapeHtml(shippingLine || '—')}</td></tr>
      </table>

      <h3 style="margin-top:24px">Items ordered</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f1f5f9;text-align:left">
            <th style="padding:8px">Product</th>
            <th style="padding:8px">Price</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px">Subtotal</th>
            <th style="padding:8px">Seller</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p style="margin-top:16px;font-size:16px;font-weight:600">
        Total paid: R${Number(order.totalAmount).toFixed(2)}
      </p>

      <p style="margin-top:24px;font-size:12px;color:#94a3b8">
        This email was sent automatically by the Fast Sports platform.
      </p>
    </div>`;

  return {
    to: getAdminRecipients(),
    subject: `New Order Confirmed — R${Number(order.totalAmount).toFixed(2)} (${order.id})`,
    html,
    context: `Admin order ${order.id}`,
  };
}

// Order receipt sent to the buyer once payment completes.
export function buildBuyerReceiptEmail({ order, itnData }) {
  const toEmail = (order.buyerEmail || '').trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://fastsport.co.za').trim();
  const fromEmail = process.env.BUYER_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const shippingLines = getShippingLines(order);
  const amountGross = itnData?.amount_gross ? `R${Number(itnData.amount_gross).toFixed(2)}` : `R${Number(order.totalAmount || 0).toFixed(2)}`;
  const ordersUrl = `${siteUrl}/profile/orders`;

  const itemRows = (order.items || []).map((item) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 8px;font-size:14px;color:#1e293b">${escapeHtml(item.name)}</td>
      <td style="padding:10px 8px;font-size:14px;color:#64748b;text-align:center">${Number(item.quantity)}</td>
      <td style="padding:10px 8px;font-size:14px;color:#1e293b;text-align:right">R${Number(item.price).toFixed(2)}</td>
      <td style="padding:10px 8px;font-size:14px;font-weight:600;color:#1e293b;text-align:right">R${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;max-width:620px;width:100%">
        <tr><td style="background:#0f172a;padding:28px 40px;text-align:center">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.06em">FAST SPORTS</p>
          <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase">Order Confirmation</p>
        </td></tr>

        <tr><td style="padding:32px 40px 16px">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a">Thanks for your order!</h1>
          <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">
            Your payment was successful. Here's a summary of what you ordered.
          </p>
          <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">
            Order reference: <span style="font-family:monospace;color:#475569">${escapeHtml(order.id)}</span>
          </p>
        </td></tr>

        <tr><td style="padding:0 40px 24px">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <thead>
              <tr style="background:#f8fafc">
                <th style="padding:10px 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:left">Product</th>
                <th style="padding:10px 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:center">Qty</th>
                <th style="padding:10px 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:right">Unit price</th>
                <th style="padding:10px 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
        </td></tr>

        <tr><td style="padding:0 40px 28px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:14px;color:#64748b;padding:6px 0">Payment method</td>
              <td style="font-size:14px;color:#1e293b;text-align:right;padding:6px 0">PayFast</td>
            </tr>
            <tr style="border-top:2px solid #e2e8f0">
              <td style="font-size:16px;font-weight:700;color:#0f172a;padding:12px 0 0">Total paid</td>
              <td style="font-size:16px;font-weight:700;color:#00CED1;text-align:right;padding:12px 0 0">${escapeHtml(amountGross)}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 40px 28px">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b">Shipping address</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:14px;color:#334155;line-height:1.8">
            ${shippingLines.map((l) => escapeHtml(l)).join('<br>')}
          </div>
        </td></tr>

        <tr><td style="padding:0 40px 36px;text-align:center">
          <a href="${ordersUrl}" target="_blank"
             style="display:inline-block;background:#00CED1;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:999px;letter-spacing:0.06em;text-transform:uppercase">
            My Orders
          </a>
          <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">
            Not logged in? You'll be asked to sign in first.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    to: toEmail,
    from: fromEmail,
    subject: `Order confirmed — ${amountGross} (ref: ${order.id})`,
    html,
    context: `Buyer receipt ${order.id}`,
  };
}

// Notifies a seller that one of their products was purchased, listing only their items in the order.
export function buildSellerNewOrderEmail({ order, sellerEmail, sellerItems }) {
  const shippingLines = getShippingLines(order);
  const subtotal = sellerItems.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);

  const itemRows = sellerItems.map((item) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 8px;font-size:14px;color:#1e293b">${escapeHtml(item.name)}</td>
      <td style="padding:10px 8px;font-size:14px;color:#64748b;text-align:center">${Number(item.quantity)}</td>
      <td style="padding:10px 8px;font-size:14px;color:#1e293b;text-align:right">R${Number(item.price).toFixed(2)}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1e293b">
      <h2 style="color:#00CED1;margin-bottom:4px">Your item sold on Fast Sports!</h2>
      <p style="color:#64748b;font-size:13px">Order ID: <code>${escapeHtml(order.id)}</code></p>

      <h3 style="margin-top:24px">Your items in this order</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f1f5f9;text-align:left">
            <th style="padding:8px">Product</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="margin-top:12px;font-size:15px;font-weight:600">Your subtotal: R${subtotal.toFixed(2)}</p>

      <h3 style="margin-top:24px">Shipping to</h3>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;font-size:14px;color:#334155;line-height:1.8">
        ${shippingLines.map((l) => escapeHtml(l)).join('<br>') || 'Not provided'}
      </div>

      <p style="margin-top:24px;font-size:13px;color:#475569">
        Please prepare this item for shipping. Fast Sports support will be in touch to arrange collection/delivery.
      </p>
      <p style="margin-top:16px;font-size:12px;color:#94a3b8">
        Questions? Contact us at ${escapeHtml(SUPPORT_EMAIL)}.
      </p>
    </div>`;

  return {
    to: sellerEmail,
    subject: `You sold an item — Order ${order.id}`,
    html,
    context: `Seller notice ${order.id}`,
  };
}

const STATUS_LABELS = {
  pending_payment: 'Pending payment',
  payment_failed: 'Payment failed',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

// Notifies support of any order fulfillment/status transition.
export function buildStatusChangeEmail({ order, previousStatus, newStatus }) {
  const fromLabel = STATUS_LABELS[previousStatus] || previousStatus || 'Unknown';
  const toLabel = STATUS_LABELS[newStatus] || newStatus;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <h2 style="color:#00CED1;margin-bottom:4px">Order status updated</h2>
      <p style="font-size:14px">Order <code>${escapeHtml(order.id)}</code> moved from <strong>${escapeHtml(fromLabel)}</strong> to <strong>${escapeHtml(toLabel)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
        <tr><td style="padding:6px 8px;color:#64748b;width:140px">Buyer</td><td style="padding:6px 8px">${escapeHtml(order.buyerEmail || '—')}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b">Total</td><td style="padding:6px 8px">R${Number(order.totalAmount || 0).toFixed(2)}</td></tr>
      </table>
    </div>`;

  return {
    to: getAdminRecipients(),
    subject: `Order ${order.id}: ${fromLabel} → ${toLabel}`,
    html,
    context: `Status change ${order.id}`,
  };
}
