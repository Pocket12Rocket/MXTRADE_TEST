/* eslint-disable no-console */
// One-off test-data reset: deletes products, productSubmissions, orders (+ refundRequests
// subcollections), adminNotifications, and their associated Storage files.
// Usage:
//   node scripts/reset-test-data.js            (dry run — lists what would be deleted)
//   node scripts/reset-test-data.js --confirm  (actually deletes)
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
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;

  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
      storageBucket,
    });
  } else if (isHostedRuntime) {
    admin.initializeApp({ storageBucket });
  } else {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON for local run. Set it in .env.local or run in hosted runtime with ADC.'
    );
  }

  return admin.app();
}

async function deleteCollectionDocs(db, collectionName, { withSubcollection } = {}) {
  const snapshot = await db.collection(collectionName).get();
  console.log(`[reset] ${collectionName}: ${snapshot.size} document(s) found`);

  if (snapshot.empty) {
    return 0;
  }

  if (!process.argv.includes('--confirm')) {
    return snapshot.size;
  }

  let deleted = 0;
  for (const docSnap of snapshot.docs) {
    if (withSubcollection) {
      const subSnap = await docSnap.ref.collection(withSubcollection).get();
      const batch = db.batch();
      subSnap.docs.forEach((subDoc) => batch.delete(subDoc.ref));
      if (!subSnap.empty) {
        await batch.commit();
      }
    }
    await docSnap.ref.delete();
    deleted += 1;
  }

  return deleted;
}

async function deleteStorageFolder(bucket, folderPath) {
  try {
    const [files] = await bucket.getFiles({ prefix: folderPath });
    console.log(`[reset] storage/${folderPath}: ${files.length} file(s) found`);
    if (files.length && process.argv.includes('--confirm')) {
      await Promise.all(files.map((file) => file.delete().catch(() => {})));
    }
    return files.length;
  } catch (err) {
    console.warn(`[reset] Could not list storage/${folderPath}:`, err.message);
    return 0;
  }
}

async function main() {
  loadLocalEnv();
  const app = getAdminApp();
  const db = app.firestore();
  const bucket = app.storage().bucket();
  const isDryRun = !process.argv.includes('--confirm');

  console.log(isDryRun ? '=== DRY RUN (pass --confirm to actually delete) ===' : '=== DELETING ===');

  await deleteCollectionDocs(db, 'orders', { withSubcollection: 'refundRequests' });
  await deleteCollectionDocs(db, 'products');
  await deleteCollectionDocs(db, 'productSubmissions');
  await deleteCollectionDocs(db, 'adminNotifications');

  await deleteStorageFolder(bucket, 'sellerSubmissions/');
  await deleteStorageFolder(bucket, 'refunds/');

  console.log(isDryRun ? '\nDry run complete. Re-run with --confirm to delete.' : '\nDone.');
}

main().catch((err) => {
  console.error('[reset] Failed:', err);
  process.exit(1);
});
