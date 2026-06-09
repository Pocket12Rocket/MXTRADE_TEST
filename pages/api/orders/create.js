import { adminDb } from '../../../../lib/firebaseAdmin';
import admin from '../../../../lib/firebaseAdmin';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST is supported' });
  }

  try {
    const { buyerId, buyerEmail, items, totalAmount, shippingAddress } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cannot create an order with no items.' });
    }

    if (!buyerId && !buyerEmail) {
      return res.status(400).json({ error: 'An email address is required to place an order.' });
    }

    const sanitizedItems = items.map((item) => ({
      productId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity),
      primaryImage: item.primaryImage || null,
    }));

    const orderRef = await adminDb.collection('orders').add({
      buyerId: buyerId || null,
      buyerEmail: buyerEmail || '',
      items: sanitizedItems,
      totalAmount: Number(totalAmount),
      shippingAddress: shippingAddress || {},
      status: 'pending_payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ success: true, orderId: orderRef.id });
  } catch (error) {
    console.error('[Orders API] Create order failed:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
