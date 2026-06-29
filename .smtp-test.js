const fs = require('fs');
const path = '.env.local';
const data = fs.readFileSync(path, 'utf8');
const env = {};
for (const line of data.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const idx = line.indexOf('=');
  if (idx < 0) continue;
  const key = line.slice(0, idx).trim();
  let val = line.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(env.SMTP_PORT || 587),
  secure: env.SMTP_SECURE === 'true',
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  requireTLS: true,
});
transporter.verify()
  .then(() => console.log('SMTP_OK'))
  .catch((err) => {
    console.error('SMTP_ERROR');
    console.error(err.message);
    if (err.response) console.error(err.response);
    process.exit(1);
  });
