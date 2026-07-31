/* eslint-disable no-console */
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
    admin.initializeApp();
  } else {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON for local migration run. Set it in .env.local or run this script in hosted runtime with ADC.'
    );
  }

  return admin.app();
}

function normalizeString(value) {
  return String(value || '').trim();
}

async function main() {
  loadLocalEnv();
  const isDryRun = !process.argv.includes('--apply');
  console.log(`Starting seller public profile migration (${isDryRun ? 'dry-run' : 'apply'})...`);

  const app = getAdminApp();
  const db = app.firestore();
  const sellerPrivateProfilesSnap = await db.collection('sellerPrivateProfiles').get();

  console.log(`Found ${sellerPrivateProfilesSnap.size} seller private profile documents.`);

  const updates = [];
  sellerPrivateProfilesSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    updates.push({
      uid: docSnap.id,
      suburb: normalizeString(data.suburb),
      city: normalizeString(data.city),
      sellerBadge: normalizeString(data.sellerBadge),
      sellerTrustScore: typeof data.sellerTrustScore === 'number' ? data.sellerTrustScore : 0,
    });
  });

  console.log(`Prepared ${updates.length} public seller profile records.`);

  if (isDryRun) {
    updates.slice(0, 10).forEach((item) => {
      console.log(`- ${item.uid}: suburb='${item.suburb}', city='${item.city}', badge='${item.sellerBadge}', trust=${item.sellerTrustScore}`);
    });
    if (updates.length > 10) {
      console.log(`...and ${updates.length - 10} more`);
    }
    console.log('Dry run complete. Re-run with --apply to write changes.');
    return;
  }

  const batchSize = 400;
  for (let index = 0; index < updates.length; index += batchSize) {
    const batch = db.batch();
    const slice = updates.slice(index, index + batchSize);

    slice.forEach((item) => {
      batch.set(
        db.collection('sellerPublicProfiles').doc(item.uid),
        {
          uid: item.uid,
          suburb: item.suburb,
          city: item.city,
          sellerBadge: item.sellerBadge,
          sellerTrustScore: item.sellerTrustScore,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log(`Committed ${slice.length} public seller profile records.`);
  }

  console.log('Seller public profile migration complete.');
}

main().catch((error) => {
  console.error('Migration failed:', error?.message || error);
  process.exitCode = 1;
});