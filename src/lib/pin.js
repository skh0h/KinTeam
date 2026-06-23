export async function hashPin(pin) {
  const data = new TextEncoder().encode(String(pin));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison to prevent timing attacks on PIN verification.
// Returns false immediately if storedHash is null/undefined or lengths differ
// (length difference is not secret — SHA-256 output is always 64 hex chars).
export async function verifyPin(inputPin, storedHash) {
  if (!storedHash) return false;
  const hashed = await hashPin(inputPin);
  if (hashed.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hashed.length; i++) {
    diff |= hashed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
