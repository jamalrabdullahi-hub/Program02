/**
 * Verifies an FTL-Pay webhook delivery.
 *
 * Node/CommonJS-friendly reference implementation — port the algorithm to your stack if
 * you're not on Node. It checks two things, and both matter: that the signature matches
 * (proves the body wasn't altered and came from someone who knows your signing secret),
 * and that the timestamp is recent (stops a captured `payment.completed` delivery being
 * replayed later to trigger a second fulfilment).
 *
 * Usage:
 *   const { verifySignature } = require('./verify-signature');
 *
 *   app.post('/webhook', (req, res) => {
 *     const ok = verifySignature(
 *       YOUR_SIGNING_SECRET,
 *       req.header('safeverify-signature'),
 *       req.rawBody // the exact bytes FTL-Pay sent — re-serializing JSON will not match
 *     );
 *     if (!ok) return res.sendStatus(400);
 *     // ...fulfil the order...
 *     res.sendStatus(200);
 *   });
 *
 * Get req.rawBody by reading the body before any JSON-parsing middleware touches it —
 * with Express, that's `express.raw({ type: 'application/json' })` on this route, not
 * `express.json()`, since the signature is computed over the exact bytes.
 */
const { createHmac, timingSafeEqual } = require('node:crypto');

function verifySignature(secret, header, body, options = {}) {
  if (!header) return false;

  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const i = piece.indexOf('=');
      return [piece.slice(0, i).trim(), piece.slice(i + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  const presented = parts.v1;
  if (!Number.isFinite(timestamp) || !presented) return false;

  const tolerance = options.toleranceSeconds ?? 300;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (Math.abs(now - timestamp) > tolerance) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(presented, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = { verifySignature };
