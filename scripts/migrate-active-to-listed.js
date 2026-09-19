/* eslint-disable no-console */
// Why: fetchLiveProducts() now queries only status=='listed' (the owner-decided single live
// status — 'active' was a legacy alias that normalizeProductRecord used to map to 'listed' on
// read, but that read-side mapping never touched the stored document). Any product doc still
// carrying status:'active' would silently stop appearing in the shop/home/product-detail reads
// once that read-side fallback is removed. This script finds and rewrites those documents.
// Pattern matches scripts/migrate-approved-brands.js: dry-run by default, --apply to write.
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const fileContents = fs.readFileSync(envPath, 'utf8');
  const lines = fileContents.split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key]) {
      return;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.GOOGLE_CLOUD_PROJECT);

  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (isHostedRuntime) {
    // Works in Firebase/Google hosted environments with ADC configured.
    admin.initializeApp();
  } else {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON for local migration run. Set it in .env.local or run this script in hosted runtime with ADC.'
    );
  }

  return admin.app();
}

const BATCH_WRITE_LIMIT = 500;

async function main() {
  loadLocalEnv();
  console.log('Starting active -> listed status migration...');
  const isDryRun = !process.argv.includes('--apply');
  const app = getAdminApp();
  const db = app.firestore();
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'apply'}`);

  const activeProductsSnap = await db.collection('products').where('status', '==', 'active').get();
  console.log('--- Active -> Listed Migration Summary ---');
  console.log(`Products with status 'active': ${activeProductsSnap.size}`);

  if (activeProductsSnap.empty) {
    console.log('Nothing to update.');
    return;
  }

  activeProductsSnap.forEach((docSnap) => {
    console.log(`- ${docSnap.id} (${docSnap.data()?.name || 'unnamed product'})`);
  });

  if (isDryRun) {
    console.log('Dry run complete. Re-run with --apply to write changes.');
    return;
  }

  const docs = activeProductsSnap.docs;
  for (let offset = 0; offset < docs.length; offset += BATCH_WRITE_LIMIT) {
    const batch = db.batch();
    const chunk = docs.slice(offset, offset + BATCH_WRITE_LIMIT);
    chunk.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        status: 'listed',
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    console.log(`Committed batch of ${chunk.length} (offset ${offset}).`);
  }

  console.log(`Applied. Updated ${docs.length} product(s) from status 'active' to 'listed'.`);
}

main().catch((error) => {
  console.error('Migration failed:', error?.message || error);
  process.exitCode = 1;
});
