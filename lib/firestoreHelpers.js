// Fetch new products by category (listed, not sold, last 7 days)
export async function fetchThisWeeksNewProductsByCategory(category, limit = 6) {
  const products = await fetchLiveProducts();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return products
    .filter((product) => {
      if (product.marketSold === true) return false;
      if (!product.category || product.category.toLowerCase() !== category.toLowerCase()) return false;
      const createdAtDate = resolveCreatedAtDate(product.createdAt);
      return createdAtDate ? createdAtDate >= sevenDaysAgo : false;
    })
    .slice(0, limit);
}
// Fetch all orders with refund_pending status
export async function fetchRefundPendingOrders() {
  const ordersQuery = query(
    collection(db, 'orders'),
    where('status', '==', 'refund_pending'),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(ordersQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

// Fetch the latest refund request for an order
export async function fetchRefundRequestForOrder(orderId) {
  if (!orderId) throw new Error('Missing orderId');
  const refundQuery = query(collection(db, 'orders', orderId, 'refundRequests'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(refundQuery);
  if (snapshot.empty) throw new Error('No refund request found');
  const docSnap = snapshot.docs[0];
  return { orderId, ...docSnap.data() };
}

// Admin processes refund request (accept/deny)
export async function processRefundRequest({ orderId, action, adminResponse }) {
  if (!orderId || !action) throw new Error('Missing required fields');
  // Update refund request status
  const refundQuery = query(collection(db, 'orders', orderId, 'refundRequests'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(refundQuery);
  if (snapshot.empty) throw new Error('No refund request found');
  const refundDoc = snapshot.docs[0];
  await updateDoc(refundDoc.ref, {
    status: action === 'accept' ? 'accepted' : 'denied',
    adminResponse: adminResponse || '',
    processedAt: serverTimestamp(),
  });
  // Update order status
  await updateDoc(doc(db, 'orders', orderId), {
    status: action === 'accept' ? 'refunded' : 'delivered',
    refundProcessedAt: serverTimestamp(),
  });
  // TODO: Send email to user (implement email logic as needed)
}
// Submit a refund request for an order
import { v4 as uuidv4 } from 'uuid';

/**
 * User submits a refund request for an order
 * @param {Object} params
 * @param {string} params.orderId
 * @param {Object} params.user
 * @param {string} params.reason
 * @param {File[]} params.images
 */
export async function submitRefundRequest({ orderId, user, reason, images }) {
  if (!orderId || !user || !reason) throw new Error('Missing required fields.');
  // Upload images to storage if provided
  let imageUrls = [];
  if (images && images.length > 0) {
    imageUrls = await Promise.all(images.map(async (file) => {
      const fileName = `${orderId}/${uuidv4()}-${file.name}`;
      const storageRef = ref(storage, `refunds/${fileName}`);
      await uploadBytes(storageRef, file);
      return getDownloadURL(storageRef);
    }));
  }
  // Write refund request to subcollection
  const refundRef = doc(collection(db, 'orders', orderId, 'refundRequests'));
  await setDoc(refundRef, {
    userId: user.uid || '',
    userEmail: user.email || '',
    reason,
    imageUrls,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  // Update order status
  await updateDoc(doc(db, 'orders', orderId), {
    status: 'refund_pending',
    refundRequestedAt: serverTimestamp(),
  });
}
// Fetch all orders for a user by email (or userId if needed)
// (removed duplicate import)

/**
 * Fetch all orders for a user by email (or userId if needed)
 * @param {string} email - The user's email address
 * @returns {Promise<Array>} Array of order objects
 */
export async function fetchUserOrders(email) {
  if (!email) return [];

  const hiddenOrderStatuses = new Set(['pending_payment', 'payment_failed', 'failed', 'cancelled']);
  const ordersQuery = query(
    collection(db, 'orders'),
    where('buyerEmail', '==', email),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(ordersQuery);

  const orderRows = await Promise.all(snapshot.docs.map(async (docSnap) => {
    const order = docSnap.data();
    const orderId = docSnap.id;

    if (hiddenOrderStatuses.has(order.status)) {
      return [];
    }

    return Promise.all((order.items || []).map(async (item) => {
      let productStatus = '';

      if (item.productId) {
        try {
          const productSnap = await getDoc(doc(db, 'products', item.productId));
          if (productSnap.exists()) {
            const productData = productSnap.data();
            if (productData.status === 'paid') {
              productStatus = 'purchased';
            } else if (productData.status) {
              productStatus = productData.status;
            } else if (productData.marketSold) {
              productStatus = 'purchased';
            }
          }
        } catch {
          // Fall back to order-level status if product lookup fails.
        }
      }

      const displayStatus = productStatus || (order.status === 'paid' ? 'purchased' : order.status || '');

      return {
        id: orderId,
        productId: item.productId,
        productName: item.name,
        imageUrl: item.primaryImage || '',
        status: displayStatus,
        createdAt: order.createdAt,
        ...item,
      };
    }));
  }));

  return orderRows.flat();
}
// Fetch a single order by ID with full product details per item
export async function fetchOrderById(orderId) {
  if (!orderId) throw new Error('Missing orderId');
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) throw new Error('Order not found');
  const order = { id: orderSnap.id, ...orderSnap.data() };

  const itemsWithProducts = await Promise.all((order.items || []).map(async (item) => {
    let product = null;
    if (item.productId) {
      try {
        const productSnap = await getDoc(doc(db, 'products', item.productId));
        if (productSnap.exists()) {
          product = { id: productSnap.id, ...productSnap.data() };
        }
      } catch {
        // Product lookup is best-effort — fall back gracefully.
      }
    }
    return { ...item, product };
  }));

  return { ...order, items: itemsWithProducts };
}

// FAQ CRUD HELPERS
export async function fetchFaqs() {
  const snapshot = await getDocs(collection(db, 'faqs'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addFaq({ question, answer }) {
  if (!question || !answer) throw new Error('Question and answer are required');
  const docRef = await addDoc(collection(db, 'faqs'), { question, answer });
  return docRef.id;
}

export async function updateFaq(id, { question, answer }) {
  if (!id || !question || !answer) throw new Error('ID, question, and answer are required');
  await updateDoc(doc(db, 'faqs', id), { question, answer });
}

export async function deleteFaq(id) {
  if (!id) throw new Error('ID is required');
  await deleteDoc(doc(db, 'faqs', id));
}
// Update product status as admin
export async function updateProductStatusAsAdmin(productId, newStatus) {
  if (!productId || !newStatus) throw new Error('Missing productId or newStatus');
  await updateDoc(doc(db, 'products', productId), {
    status: newStatus,
    statusUpdatedAt: serverTimestamp(),
  });
}
// Fetch all sellers (users with canSell true)
export async function fetchAllSellers() {
  const usersQuery = query(collection(db, 'users'), where('canSell', '==', true));
  const snapshot = await getDocs(usersQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}
import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, serverTimestamp, setDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from './firebase';

function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

async function sendSubmissionEmailNotification(payload) {
  try {
    const currentUser = auth.currentUser;
    const idToken = currentUser ? await currentUser.getIdToken() : '';

    const response = await fetch('/api/submissions/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.warn('[Submission Notifications] Email API failed', {
        status: response.status,
        body: responseText,
        eventType: payload?.eventType,
      });
    }
  } catch (error) {
    console.warn('[Submission Notifications] Email API request failed', {
      eventType: payload?.eventType,
      message: error?.message,
    });
  }
}

export async function createUserProfile(user, role = 'customer', profileData = {}) {
  const firstName = (profileData.firstName || '').trim();
  const lastName = (profileData.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = (profileData.phone || '').trim();
  const countryCode = (profileData.countryCode || '+27').trim();

  const userDoc = doc(db, 'users', user.uid);
  await setDoc(userDoc, {
    uid: user.uid,
    email: user.email,
    role,
    createdAt: serverTimestamp(),
    displayName: fullName || user.displayName || '',
    firstName,
    lastName,
    phone,
    countryCode,
    canSell: false,
    sellerProfileComplete: false,
  });
}

export async function submitProductRequest({ user, name, price, category, subcategory, description, specifications, files, customFields = {} }) {
  try {
    const normalizedName = String(name || '').trim();
    const normalizedCategory = String(category || '').trim();
    const normalizedSubcategory = String(subcategory || '').trim();
    const normalizedDescription = String(description || '').trim();
    const normalizedPrice = Number(price);
    const normalizedSpecifications = String(specifications || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!normalizedName || !normalizedCategory || !normalizedSubcategory || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      throw new Error('Please complete all required fields before submitting.');
    }

    if (!files || files.length === 0) {
      throw new Error('Please upload product images before submitting for review.');
    }

    const submissionRef = doc(collection(db, 'productSubmissions'));

    const uploadPromises = Array.from(files)
      .slice(0, 5)
      .map(async (file) => {
        const storageRef = ref(storage, `sellerSubmissions/${user.uid}/${submissionRef.id}/${file.name}`);
        await withTimeout(
          uploadBytes(storageRef, file),
          120000,
          'Image upload timed out. Check your connection, file size, and Firebase Storage setup, then try again.'
        );
        return getDownloadURL(storageRef);
      });

    const imageUrls = await Promise.all(uploadPromises);

    await withTimeout(
      setDoc(submissionRef, {
        sellerId: user.uid,
        sellerEmail: user.email,
        name: normalizedName,
        price: normalizedPrice,
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        description: normalizedDescription,
        specifications: normalizedSpecifications,
        status: 'pending',
        marketSold: false,
        createdAt: serverTimestamp(),
        primaryImage: imageUrls[0] || null,
        images: imageUrls,
        ...customFields,
      }),
      30000,
      'Submission timed out while creating the product request. Please try again.'
    );

    await sendSubmissionEmailNotification({
      eventType: 'submission_created',
      submissionId: submissionRef.id,
      sellerId: user.uid,
    });

    return submissionRef.id;
  } catch (error) {
    if (error?.code === 'storage/unauthorized') {
      throw new Error('Image upload blocked by Firebase Storage Rules. Make sure you are signed in and the latest storage.rules have been deployed.');
    }

    if (error?.code === 'storage/bucket-not-found') {
      throw new Error('Firebase Storage bucket not found. Verify NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET in .env.local and create Storage in Firebase Console.');
    }

    if (error?.code === 'storage/unknown') {
      throw new Error('Image upload failed due to a Firebase Storage error. Check Storage is enabled and your bucket configuration is correct.');
    }

    throw error;
  }
}


export async function fetchLiveProducts(options = {}) {
  const { includeAllStatuses = false } = options;

  // Read all products in one query, then apply public visibility filtering in code.
  // This keeps backwards compatibility with older records that used status='active'.
  const productsQuery = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(productsQuery);
  const products = snapshot.docs
    .map((docItem) => normalizeProductRecord({ id: docItem.id, ...docItem.data() }))
    .filter((product) => {
      if (includeAllStatuses) {
        return true;
      }

      const normalizedStatus = String(product.status || '').toLowerCase();
      const isPublicStatus = !normalizedStatus || normalizedStatus === 'listed';
      return isPublicStatus && product.marketSold !== true;
    });
  // Fetch seller suburb/city for each product
  const productsWithSellerInfo = await Promise.all(
    products.map(async (product) => {
      if (product.sellerId) {
        try {
          const sellerProfile = await fetchSellerPrivateProfile(product.sellerId);
          return {
            ...product,
            sellerSuburb: sellerProfile?.suburb || '',
            sellerCity: sellerProfile?.city || '',
            sellerBadge: sellerProfile?.sellerBadge || '',
            sellerTrustScore: sellerProfile?.sellerTrustScore ?? null,
          };
        } catch {
          return { ...product, sellerSuburb: '', sellerCity: '', sellerBadge: '', sellerTrustScore: null };
        }
      }
      return { ...product, sellerSuburb: '', sellerCity: '', sellerBadge: '', sellerTrustScore: null };
    })
  );
  return productsWithSellerInfo;
}

function normalizeProductImages(productData) {
  const normalized = [];

  if (typeof productData.primaryImage === 'string' && productData.primaryImage.trim()) {
    normalized.push(productData.primaryImage.trim());
  }

  if (Array.isArray(productData.images) && productData.images.length > 0) {
    productData.images.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        normalized.push(item.trim());
      } else if (item && typeof item === 'object') {
        const objectUrl = item.url || item.src || item.downloadURL;
        if (typeof objectUrl === 'string' && objectUrl.trim()) {
          normalized.push(objectUrl.trim());
        }
      }
    });
  }

  if (Array.isArray(productData.imageUrls) && productData.imageUrls.length > 0) {
    productData.imageUrls.forEach((url) => {
      if (typeof url === 'string' && url.trim()) {
        normalized.push(url.trim());
      }
    });
  }

  if (typeof productData.imageUrl === 'string' && productData.imageUrl.trim()) {
    normalized.push(productData.imageUrl.trim());
  }

  return Array.from(new Set(normalized));
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function parseDateLike(value) {
  if (!value) {
    return null;
  }

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'string') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function resolveProductPricing(record, now = new Date()) {
  const basePrice = Math.max(0, toFiniteNumber(record.basePrice, toFiniteNumber(record.price, 0)));
  const specialEnabled = Boolean(record.specialEnabled);
  const specialType = ['percent', 'amount', 'fixed'].includes(record.specialType) ? record.specialType : 'percent';
  const specialValue = Math.max(0, toFiniteNumber(record.specialValue, 0));
  const specialStartDate = parseDateLike(record.specialStartAt);
  const specialEndDate = parseDateLike(record.specialEndAt);

  const withinStartWindow = !specialStartDate || now >= specialStartDate;
  const withinEndWindow = !specialEndDate || now <= specialEndDate;
  const isScheduledActive = withinStartWindow && withinEndWindow;

  let discountedPrice = basePrice;
  if (specialEnabled && isScheduledActive) {
    if (specialType === 'percent') {
      discountedPrice = basePrice * (1 - specialValue / 100);
    } else if (specialType === 'amount') {
      discountedPrice = basePrice - specialValue;
    } else if (specialType === 'fixed') {
      discountedPrice = specialValue;
    }
  }

  const normalizedDiscountedPrice = Math.max(0, Math.round(discountedPrice * 100) / 100);
  const isSpecialActive = specialEnabled && isScheduledActive && normalizedDiscountedPrice < basePrice;

  return {
    basePrice,
    currentPrice: isSpecialActive ? normalizedDiscountedPrice : basePrice,
    isSpecialActive,
    specialLabel: (record.specialLabel || '').trim(),
    specialType,
    specialValue,
    specialStartAt: record.specialStartAt || '',
    specialEndAt: record.specialEndAt || '',
  };
}

function normalizeProductRecord(record) {
  const images = normalizeProductImages(record);
  const pricing = resolveProductPricing(record);
  const rawStatus = String(record.status || '').toLowerCase();
  const normalizedStatus = rawStatus === 'paid'
    ? 'purchased'
    : (rawStatus === 'active' ? 'listed' : (record.status || (record.marketSold ? 'purchased' : 'listed')));

  return {
    ...record,
    status: normalizedStatus,
    images,
    primaryImage: images[0] || null,
    basePrice: pricing.basePrice,
    price: pricing.currentPrice,
    originalPrice: pricing.isSpecialActive ? pricing.basePrice : null,
    isSpecialActive: pricing.isSpecialActive,
    specialLabel: pricing.isSpecialActive ? (pricing.specialLabel || 'Special') : '',
    specialType: pricing.specialType,
    specialValue: pricing.specialValue,
    specialStartAt: pricing.specialStartAt,
    specialEndAt: pricing.specialEndAt,
  };
}

function resolveCreatedAtDate(createdAt) {
  if (!createdAt) {
    return null;
  }

  if (typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }

  if (typeof createdAt.seconds === 'number') {
    return new Date(createdAt.seconds * 1000);
  }

  return null;
}

export async function updateUserProfile(user, profileData = {}) {
  const firstName = (profileData.firstName || '').trim();
  const lastName = (profileData.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const phone = (profileData.phone || '').trim();
  const countryCode = (profileData.countryCode || '+27').trim();

  await updateDoc(doc(db, 'users', user.uid), {
    firstName,
    lastName,
    displayName: fullName,
    phone,
    countryCode,
  });
}

export async function updateProductPricingAsAdmin(productId, pricingData = {}, adminId = 'admin') {
  const basePrice = toFiniteNumber(pricingData.basePrice, NaN);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    throw new Error('Base price must be greater than 0.');
  }

  const specialEnabled = Boolean(pricingData.specialEnabled);
  const specialType = ['percent', 'amount', 'fixed'].includes(pricingData.specialType) ? pricingData.specialType : 'percent';
  const specialValue = Math.max(0, toFiniteNumber(pricingData.specialValue, 0));
  const specialLabel = (pricingData.specialLabel || '').trim();
  const specialStartAt = (pricingData.specialStartAt || '').trim();
  const specialEndAt = (pricingData.specialEndAt || '').trim();

  const startDate = parseDateLike(specialStartAt);
  const endDate = parseDateLike(specialEndAt);
  if (startDate && endDate && endDate < startDate) {
    throw new Error('Special end date must be after start date.');
  }

  if (specialEnabled) {
    if (specialType === 'percent' && (specialValue <= 0 || specialValue > 100)) {
      throw new Error('Percent special must be between 0 and 100.');
    }

    if (specialType === 'amount' && specialValue <= 0) {
      throw new Error('Amount discount must be greater than 0.');
    }

    if (specialType === 'fixed' && specialValue < 0) {
      throw new Error('Fixed special price cannot be negative.');
    }
  }

  await updateDoc(doc(db, 'products', productId), {
    basePrice,
    // Keep legacy price field aligned with base price for backwards compatibility.
    price: basePrice,
    specialEnabled,
    specialType,
    specialValue: specialEnabled ? specialValue : 0,
    specialLabel,
    specialStartAt,
    specialEndAt,
    pricingUpdatedAt: serverTimestamp(),
    pricingUpdatedBy: adminId,
  });
}

export async function uploadProfilePicture(user, file) {
  const storageRef = ref(storage, `profilePictures/${user.uid}`);
  await withTimeout(
    uploadBytes(storageRef, file),
    60000,
    'Profile picture upload timed out. Please try again.'
  );
  const photoURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', user.uid), { photoURL });
  return photoURL;
}

export async function fetchThisWeeksNewProducts(limit = 6) {
  const products = await fetchLiveProducts();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return products
    .filter((product) => {
      if (product.marketSold === true) {
        return false;
      }

      const createdAtDate = resolveCreatedAtDate(product.createdAt);
      return createdAtDate ? createdAtDate >= sevenDaysAgo : false;
    })
    .slice(0, limit);
}

export async function fetchMostClickedProducts(limit = 6) {
  const products = await fetchLiveProducts();

  return products
    .filter((product) => {
      if (product.marketSold === true) {
        return false;
      }

      // Exclude seeded demo catalog items so this reflects real user listings.
      return product.sellerId && product.sellerId !== 'demo-seed';
    })
    .sort((a, b) => {
      const clickDelta = (Number(b.clickCount) || 0) - (Number(a.clickCount) || 0);
      if (clickDelta !== 0) {
        return clickDelta;
      }

      const aDate = resolveCreatedAtDate(a.createdAt);
      const bDate = resolveCreatedAtDate(b.createdAt);
      return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
    })
    .slice(0, limit);
}

export async function incrementProductClickCount(productId) {
  const productDoc = doc(db, 'products', productId);
  await updateDoc(productDoc, {
    clickCount: increment(1),
  });
}

export async function removeProductAsAdmin(productId) {
  await deleteDoc(doc(db, 'products', productId));
}


export async function fetchProductById(productId) {
  const productDoc = await getDoc(doc(db, 'products', productId));
  if (!productDoc.exists()) {
    return null;
  }
  const product = normalizeProductRecord({ id: productDoc.id, ...productDoc.data() });
  if (product.sellerId) {
    try {
      const sellerProfile = await fetchSellerPrivateProfile(product.sellerId);
      return {
        ...product,
        sellerSuburb: sellerProfile?.suburb || '',
        sellerCity: sellerProfile?.city || '',
        sellerBadge: sellerProfile?.sellerBadge || '',
        sellerTrustScore: sellerProfile?.sellerTrustScore ?? null,
      };
    } catch {
      return { ...product, sellerSuburb: '', sellerCity: '', sellerBadge: '', sellerTrustScore: null };
    }
  }
  return { ...product, sellerSuburb: '', sellerCity: '', sellerBadge: '', sellerTrustScore: null };
}

export async function fetchUserProfileById(userId) {
  if (!userId) {
    return null;
  }

  const userDoc = await getDoc(doc(db, 'users', userId));
  return userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null;
}

export async function fetchSellerPrivateProfile(userId) {
  if (!userId) {
    return null;
  }

  const sellerDoc = await getDoc(doc(db, 'sellerPrivateProfiles', userId));
  return sellerDoc.exists() ? { id: sellerDoc.id, ...sellerDoc.data() } : null;
}


export async function upsertSellerPrivateProfile(user, sellerData = {}) {
  if (!user?.uid) {
    throw new Error('User must be logged in to update seller profile.');
  }

  const normalized = {
    idNumber: (sellerData.idNumber || '').trim(),
    streetAddress: (sellerData.streetAddress || '').trim(),
    suburb: (sellerData.suburb || '').trim(),
    city: (sellerData.city || '').trim(),
    postCode: (sellerData.postCode || '').trim(),
    bankName: (sellerData.bankName || '').trim(),
    accountType: (sellerData.accountType || '').trim(),
    branchName: (sellerData.branchName || '').trim(),
    branchCode: (sellerData.branchCode || '').trim(),
    accountNumber: (sellerData.accountNumber || '').trim(),
    updatedAt: serverTimestamp(),
    sellerTrustScore: typeof sellerData.sellerTrustScore === 'number' ? sellerData.sellerTrustScore : 0,
    sellerBadge: sellerData.sellerBadge || '',
  };

  await setDoc(
    doc(db, 'sellerPrivateProfiles', user.uid),
    {
      uid: user.uid,
      ...normalized,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  await updateDoc(doc(db, 'users', user.uid), {
    sellerProfileComplete: true,
    canSell: true,
  });
}

// Helper to determine badge from trust score
export function getSellerBadgeFromScore(score) {
  if (typeof score !== 'number' || score < 5) return '';
  if (score >= 10) return 'platinum';
  if (score >= 5) return 'gold';
  return '';
}

// Update trust score and badge (call on sale/refund)
export async function updateSellerTrustScore(sellerId, delta) {
  if (!sellerId || typeof delta !== 'number') return;
  const sellerRef = doc(db, 'sellerPrivateProfiles', sellerId);
  const sellerSnap = await getDoc(sellerRef);
  let currentScore = 0;
  if (sellerSnap.exists()) {
    currentScore = sellerSnap.data().sellerTrustScore || 0;
  }
  let newScore = currentScore + delta;
  if (newScore < 0) newScore = 0;
  const badge = getSellerBadgeFromScore(newScore);
  await updateDoc(sellerRef, {
    sellerTrustScore: newScore,
    sellerBadge: badge,
  });
  return { sellerTrustScore: newScore, sellerBadge: badge };
}

export async function fetchSellerSubmissions(userId) {
  const submissionsQuery = query(
    collection(db, 'productSubmissions'),
    where('sellerId', '==', userId)
  );

  const snapshot = await getDocs(submissionsQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function fetchSellerLiveProducts(userId) {
  const productsQuery = query(
    collection(db, 'products'),
    where('sellerId', '==', userId)
  );

  const snapshot = await getDocs(productsQuery);
  return snapshot.docs.map((docItem) => normalizeProductRecord({ id: docItem.id, ...docItem.data() }));
}

export async function removeSellerSubmission(submissionId) {
  await deleteDoc(doc(db, 'productSubmissions', submissionId));
}

export async function removeSellerProduct(productId) {
  await deleteDoc(doc(db, 'products', productId));
}

export async function updateSellerSubmission(submissionId, updates) {
  await updateDoc(doc(db, 'productSubmissions', submissionId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function updateSellerSubmissionImages({
  userId,
  submissionId,
  existingImageUrls = [],
  retainedImageUrls = [],
  newFiles = [],
}) {
  if (!userId || !submissionId) {
    throw new Error('Missing seller context for image updates.');
  }

  const normalizedRetained = Array.from(
    new Set(
      retainedImageUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean)
    )
  );

  const uploadedUrls = await Promise.all(
    newFiles.map(async (file, index) => {
      const safeFileName = `${Date.now()}-${index}-${file.name}`;
      const storageRef = ref(storage, `sellerSubmissions/${userId}/${submissionId}/${safeFileName}`);
      await withTimeout(
        uploadBytes(storageRef, file),
        120000,
        'Image upload timed out. Check your connection and try again.'
      );
      return getDownloadURL(storageRef);
    })
  );

  const mergedUrls = [...normalizedRetained, ...uploadedUrls];

  const removedUrls = existingImageUrls.filter((url) => !normalizedRetained.includes(url));
  await Promise.all(
    removedUrls.map(async (url) => {
      try {
        await deleteObject(ref(storage, url));
      } catch {
        // Ignore cleanup failures to avoid blocking successful edit updates.
      }
    })
  );

  return {
    images: mergedUrls,
    primaryImage: mergedUrls[0] || null,
  };
}

export async function fetchPendingSubmissions() {
  const pendingQuery = query(
    collection(db, 'productSubmissions'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(pendingQuery);
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function fetchUnreadAdminNotificationCount() {
  const notificationsQuery = query(
    collection(db, 'adminNotifications'),
    where('read', '==', false)
  );

  const snapshot = await getDocs(notificationsQuery);
  return snapshot.size;
}

export async function markAdminNotificationsRead() {
  const notificationsQuery = query(
    collection(db, 'adminNotifications'),
    where('read', '==', false)
  );

  const snapshot = await getDocs(notificationsQuery);
  if (snapshot.empty) return;

  await Promise.all(snapshot.docs.map((docItem) => updateDoc(docItem.ref, {
    read: true,
    readAt: serverTimestamp(),
  })));
}

export async function fetchGearBrandOptions() {
  const gearBrandsDoc = await getDoc(doc(db, 'catalogConfig', 'gearBrands'));
  if (!gearBrandsDoc.exists()) {
    return [];
  }

  const brands = Array.isArray(gearBrandsDoc.data()?.brands) ? gearBrandsDoc.data().brands : [];
  return brands
    .map((brand) => (typeof brand === 'string' ? brand.trim() : ''))
    .filter(Boolean);
}

export async function addApprovedGearBrand(brandName, adminId = '') {
  const normalizedBrand = (brandName || '').trim();
  if (!normalizedBrand) {
    return;
  }

  const gearBrandsRef = doc(db, 'catalogConfig', 'gearBrands');
  const currentSnapshot = await getDoc(gearBrandsRef);
  const existingBrands = currentSnapshot.exists() && Array.isArray(currentSnapshot.data()?.brands)
    ? currentSnapshot.data().brands
      .map((brand) => (typeof brand === 'string' ? brand.trim() : ''))
      .filter(Boolean)
    : [];

  const brandExists = existingBrands.some((brand) => brand.toLowerCase() === normalizedBrand.toLowerCase());
  if (brandExists) {
    return;
  }

  await setDoc(
    gearBrandsRef,
    {
      brands: [...existingBrands, normalizedBrand],
      updatedAt: serverTimestamp(),
      updatedBy: adminId || 'admin',
    },
    { merge: true }
  );
}

export async function fetchBikeModelOptions() {
  const bikeModelsDoc = await getDoc(doc(db, 'catalogConfig', 'bikeModels'));
  if (!bikeModelsDoc.exists()) {
    return {};
  }

  const source = bikeModelsDoc.data()?.modelsByManufacturer;
  if (!source || typeof source !== 'object') {
    return {};
  }

  const normalized = {};
  Object.entries(source).forEach(([manufacturer, models]) => {
    const manufacturerKey = String(manufacturer || '').trim();
    if (!manufacturerKey || !Array.isArray(models)) {
      return;
    }

    const cleanedModels = Array.from(new Set(
      models
        .map((model) => String(model || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    if (cleanedModels.length > 0) {
      normalized[manufacturerKey] = cleanedModels;
    }
  });

  return normalized;
}

export async function addApprovedBikeModels(manufacturerName, modelNames = [], adminId = '') {
  const normalizedManufacturer = String(manufacturerName || '').trim();
  if (!normalizedManufacturer || normalizedManufacturer.toLowerCase() === 'universal') {
    return;
  }

  const normalizedModels = Array.from(new Set(
    (Array.isArray(modelNames) ? modelNames : [modelNames])
      .map((model) => String(model || '').trim())
      .filter(Boolean)
  ));

  if (normalizedModels.length === 0) {
    return;
  }

  const bikeModelsRef = doc(db, 'catalogConfig', 'bikeModels');
  const currentSnapshot = await getDoc(bikeModelsRef);
  const existingModelsByManufacturer = currentSnapshot.exists() && typeof currentSnapshot.data()?.modelsByManufacturer === 'object'
    ? currentSnapshot.data().modelsByManufacturer
    : {};

  const existingModels = Array.isArray(existingModelsByManufacturer[normalizedManufacturer])
    ? existingModelsByManufacturer[normalizedManufacturer]
      .map((model) => String(model || '').trim())
      .filter(Boolean)
    : [];

  const mergedModels = Array.from(new Set([...existingModels, ...normalizedModels]))
    .sort((a, b) => a.localeCompare(b));

  await setDoc(
    bikeModelsRef,
    {
      modelsByManufacturer: {
        ...existingModelsByManufacturer,
        [normalizedManufacturer]: mergedModels,
      },
      updatedAt: serverTimestamp(),
      updatedBy: adminId || 'admin',
    },
    { merge: true }
  );
}

export async function approveSubmission(submissionId, adminId) {
  const submissionDoc = doc(db, 'productSubmissions', submissionId);
  const snapshot = await getDoc(submissionDoc);
  if (!snapshot.exists()) {
    throw new Error('Submission not found');
  }

  const submission = snapshot.data();
  const basePrice = Number(submission.price) || 0;
  const productRef = await addDoc(collection(db, 'products'), {
    ...submission,
    price: basePrice,
    basePrice,
    specialEnabled: false,
    specialType: 'percent',
    specialValue: 0,
    specialLabel: '',
    specialStartAt: '',
    specialEndAt: '',
    status: 'listed',
    marketSold: submission.marketSold ?? false,
    clickCount: Number(submission.clickCount) || 0,
    primaryImage: submission.primaryImage || submission.images?.[0] || null,
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    createdAt: submission.createdAt,
  });

  await updateDoc(submissionDoc, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: adminId,
    productId: productRef.id,
  });

  const approvedCustomBrands = Array.from(
    new Set([
      (submission.customGearBrand || '').trim(),
      (submission.customAccessoriesBrand || '').trim(),
      (submission.customPartsBrand || '').trim(),
      ((submission.manufacturer || '').trim() === 'Other' ? (submission.otherManufacturer || '').trim() : ''),
    ].filter(Boolean))
  );

  if (approvedCustomBrands.length > 0) {
    await Promise.all(approvedCustomBrands.map((brand) => addApprovedGearBrand(brand, adminId)));
  }

  const approvedManufacturer = ((submission.manufacturer || '').trim() === 'Other'
    ? (submission.otherManufacturer || '').trim()
    : (submission.manufacturer || '').trim());

  const approvedModels = Array.isArray(submission.model)
    ? submission.model.map((item) => String(item || '').trim()).filter(Boolean)
    : (typeof submission.model === 'string' && submission.model.trim() ? [submission.model.trim()] : []);

  if (approvedManufacturer && approvedManufacturer.toLowerCase() !== 'universal' && approvedModels.length > 0) {
    await addApprovedBikeModels(approvedManufacturer, approvedModels, adminId);
  }

  await sendSubmissionEmailNotification({
    eventType: 'submission_approved',
    submissionId,
    productId: productRef.id,
  });
}

export async function createOrder({ buyerId, buyerEmail, items, totalAmount, shippingAddress, deliveryFee = 0, shippingSellerCount = 0 }) {
  if (!items || items.length === 0) throw new Error('Cannot create an order with no items.');
  if (!buyerId && !buyerEmail) throw new Error('An email address is required to place an order.');

  const sanitizedItems = items.map((item) => ({
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: Number(item.quantity),
    primaryImage: item.primaryImage || null,
    sellerId: item.sellerId || '',
    sellerEmail: item.sellerEmail || '',
  }));

  const orderRef = await addDoc(collection(db, 'orders'), {
    buyerId,
    buyerEmail: buyerEmail || '',
    items: sanitizedItems,
    totalAmount: Number(totalAmount),
    deliveryFee: Number(deliveryFee || 0),
    shippingSellerCount: Number(shippingSellerCount || 0),
    shippingAddress,
    status: 'pending_payment',
    createdAt: serverTimestamp(),
  });

  return orderRef.id;
}

export async function rejectSubmission(submissionId, adminId, reason) {
  const submissionDoc = doc(db, 'productSubmissions', submissionId);
  const snapshot = await getDoc(submissionDoc);
  if (!snapshot.exists()) {
    throw new Error('Submission not found');
  }

  const rejectionReason = reason || 'Rejected by admin at this time.';

  await updateDoc(submissionDoc, {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: adminId,
    rejectionReason,
  });

  await sendSubmissionEmailNotification({
    eventType: 'submission_rejected',
    submissionId,
    rejectionReason,
  });
}

export async function seedDemoProducts(adminUser) {
  const demoProducts = [
    {
      name: 'Workshop Tool Roll',
      category: 'Accessories',
      subcategory: 'Tools and Maintenance',
      price: 29.99,
      description: 'Compact dirt-bike tool roll for quick pit and trail fixes.',
      specifications: ['Water-resistant outer shell', 'Multiple tool sleeves', 'Roll-up strap closure'],
      images: ['https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'TrailMaster Helmet',
      category: 'Gear',
      subcategory: 'Helmets',
      price: 89.99,
      description: 'Lightweight safety helmet for daily rides and long trips.',
      specifications: ['Impact-resistant shell', 'Ventilation channels', 'Adjustable fit dial'],
      images: ['https://images.unsplash.com/photo-1613214150388-70f7ebf9f2ea?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'All-Weather Riding Gloves',
      category: 'Gear',
      subcategory: 'Gloves',
      price: 34.5,
      description: 'Water-resistant gloves with reinforced palm grip.',
      specifications: ['Touchscreen compatible', 'Thermal lining', 'Breathable fabric'],
      images: ['https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'Performance Brake Pad Kit',
      category: 'Parts',
      subcategory: 'Brakes',
      price: 49.99,
      description: 'Durable replacement pads for reliable stopping power.',
      specifications: ['Heat-resistant compound', 'Low noise design', 'Front axle fitment'],
      images: ['https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1000&q=80'],
    },
    {
      name: 'Heavy Duty Chain Set',
      category: 'Parts',
      subcategory: 'Chain and Sprockets',
      price: 74.99,
      description: 'High-tensile chain set designed for longevity and smooth transfer.',
      specifications: ['Corrosion resistant', 'Pre-lubricated links', 'Fits standard sprockets'],
      images: ['https://images.unsplash.com/photo-1486754735734-325b5831c3ad?auto=format&fit=crop&w=1000&q=80'],
    },
  ];

  const writeOps = demoProducts.map((product) =>
    addDoc(collection(db, 'products'), {
      ...product,
      status: 'active',
      marketSold: false,
      clickCount: 0,
      primaryImage: product.images?.[0] || null,
      sellerEmail: 'demo@mxtrade.local',
      sellerId: 'demo-seed',
      approvedBy: adminUser?.uid || 'manual-seed',
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  );

  await Promise.all(writeOps);
  return demoProducts.length;
}

export async function removeDemoProducts() {
  const demoProductsQuery = query(
    collection(db, 'products'),
    where('sellerId', '==', 'demo-seed')
  );

  const snapshot = await getDocs(demoProductsQuery);
  if (snapshot.empty) {
    return 0;
  }

  const deleteOps = snapshot.docs.map((docItem) => deleteDoc(doc(db, 'products', docItem.id)));
  await Promise.all(deleteOps);
  return snapshot.size;
}
