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
console.log('SMTP_USER=' + env.SMTP_USER);
console.log('SMTP_PASS=' + (env.SMTP_PASS ? 'SET' : 'EMPTY'));
console.log('CONTACT_FROM_EMAIL=' + env.CONTACT_FROM_EMAIL);
