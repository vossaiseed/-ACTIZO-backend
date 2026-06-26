import bcrypt from 'bcryptjs'

/** Generate a random 6-digit PIN string. */
export function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** Hash a PIN for storage. */
export async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10)
}

/** Compare a plaintext PIN against a stored hash. */
export async function verifyPin(pin, hash) {
  if (!hash) return false
  return bcrypt.compare(String(pin), hash)
}

export default { generatePin, hashPin, verifyPin }
