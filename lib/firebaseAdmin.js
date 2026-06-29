import admin from 'firebase-admin';

function getServiceAccount() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return null;
  }

  try {
    return JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
}

// Prevent re-initialising the app on hot-reloads in dev
if (!admin.apps.length) {
  const serviceAccount = getServiceAccount();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'mx-trade-163ce';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  } else {
    admin.initializeApp({
      projectId,
    });
  }
}

export const adminDb = admin.firestore();
export default admin;
