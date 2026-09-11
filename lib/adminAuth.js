import admin, { adminDb } from './firebaseAdmin';

function getBearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

// Verifies the request's ID token belongs to a user with role 'admin'; throws otherwise.
export async function requireAdminFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error('Missing authorization token.');
  }

  const decoded = await admin.auth().verifyIdToken(token);
  const userSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists || userSnap.data()?.role !== 'admin') {
    throw new Error('Admin privileges required.');
  }

  return decoded;
}
