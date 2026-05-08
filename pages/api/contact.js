import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { name, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `${name} <${email}>`, // Use the sender's email
      replyTo: email, // Set reply-to for convenience
      to: process.env.SUPPORT_EMAIL || 'support@fastsport.co.za',
      subject: 'New Contact Form Submission',
      html: `<p><b>Name:</b> ${name}</p>
             <p><b>Email:</b> ${email}</p>
             <p><b>Message:</b><br/>${message}</p>`,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email send error:', err); // Log error details
    res.status(500).json({ error: 'Failed to send email.' });
  }
}
