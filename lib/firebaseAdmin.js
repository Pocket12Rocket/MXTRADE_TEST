import admin from 'firebase-admin';

// Prevent re-initialising the app on hot-reloads in dev
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  // In App Hosting / Cloud Run, default credentials are available and preferred.
  if (!serviceAccountJson) {
    admin.initializeApp();
  } else {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

export const adminDb = admin.firestore();
export default admin;
