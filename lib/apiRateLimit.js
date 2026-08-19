const buckets = new Map();
const MAX_BUCKETS = 10000;

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return forwardedFor[0].trim();
  }

  return req.socket?.remoteAddress || 'unknown';
}

function pruneBuckets(now) {
  if (buckets.size < MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }

  while (buckets.size >= MAX_BUCKETS) {
    buckets.delete(buckets.keys().next().value);
  }
}

export function rateLimit(req, res, { name, limit, windowMs, key } = {}) {
  const now = Date.now();
  const bucketKey = `${name || 'api'}:${key || getClientIp(req)}`;
  let bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    pruneBuckets(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }

  return true;
}

export function getRateLimitKey(req, suffix = '') {
  const ip = getClientIp(req);
  return suffix ? `${ip}:${suffix}` : ip;
}