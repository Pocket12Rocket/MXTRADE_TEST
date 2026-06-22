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
    // Works in Firebase/Google hosted environments with ADC configured.
    admin.initializeApp();
  } else {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_JSON for local migration run. Set it in .env.local or run this script in hosted runtime with ADC.'
    );
  }

  return admin.app();
}

function normalizeBrand(value) {
  return String(value || '').trim();
}

function collectFromRecord(record) {
  const brands = new Set();

  const customBrandCandidates = [
    record.customGearBrand,
    record.customAccessoriesBrand,
    record.customPartsBrand,
    record.brand,
  ];

  customBrandCandidates.forEach((candidate) => {
    const normalized = normalizeBrand(candidate);
    if (normalized) {
      brands.add(normalized);
    }
  });

  const manufacturer = normalizeBrand(record.manufacturer);
  const otherManufacturer = normalizeBrand(record.otherManufacturer);
  if (manufacturer === 'Other' && otherManufacturer) {
    brands.add(otherManufacturer);
  }

  return brands;
}

async function main() {
  loadLocalEnv();
  console.log('Starting brand migration...');
  const isDryRun = !process.argv.includes('--apply');
  const app = getAdminApp();
  const db = app.firestore();
  console.log(`Mode: ${isDryRun ? 'dry-run' : 'apply'}`);

  const gearBrandsRef = db.collection('catalogConfig').doc('gearBrands');
  const [gearBrandsSnap, productsSnap, approvedSubmissionsSnap] = await Promise.all([
    gearBrandsRef.get(),
    db.collection('products').get(),
    db.collection('productSubmissions').where('status', '==', 'approved').get(),
  ]);
  console.log('Fetched source collections.');

  const existingBrands = gearBrandsSnap.exists && Array.isArray(gearBrandsSnap.data()?.brands)
    ? gearBrandsSnap.data().brands
        .map((brand) => normalizeBrand(brand))
        .filter(Boolean)
    : [];

  const discoveredBrands = new Set();

  productsSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    collectFromRecord(data).forEach((brand) => discoveredBrands.add(brand));
  });

  approvedSubmissionsSnap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    collectFromRecord(data).forEach((brand) => discoveredBrands.add(brand));
  });

  const existingLower = new Set(existingBrands.map((brand) => brand.toLowerCase()));
  const toAdd = Array.from(discoveredBrands)
    .filter((brand) => !existingLower.has(brand.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  console.log('--- Brand Migration Summary ---');
  console.log(`Existing global brands: ${existingBrands.length}`);
  console.log(`Discovered across products + approved submissions: ${discoveredBrands.size}`);
  console.log(`New brands to add: ${toAdd.length}`);

  if (toAdd.length > 0) {
    console.log('Brands to add:');
    toAdd.forEach((brand) => console.log(`- ${brand}`));
  }

  if (isDryRun) {
    console.log('Dry run complete. Re-run with --apply to write changes.');
    return;
  }

  if (toAdd.length === 0) {
    console.log('Nothing to update.');
    return;
  }

  const updatedBrands = [...existingBrands, ...toAdd].sort((a, b) => a.localeCompare(b));

  await gearBrandsRef.set(
    {
      brands: updatedBrands,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'one-time-migration',
    },
    { merge: true }
  );

  console.log(`Applied. Total global brands is now ${updatedBrands.length}.`);
}

main().catch((error) => {
  console.error('Migration failed:', error?.message || error);
  process.exitCode = 1;
});
