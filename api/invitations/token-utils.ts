import { createHash, randomBytes } from 'crypto';

/**
 * Token utilities for client invitations.
 *
 * SECURITY: Activation tokens are stored as SHA-256 hashes.
 * The raw token is only returned once (in the activation link)
 * and never stored in plaintext. When validating, the incoming
 * token is hashed and compared against the stored hash.
 */

/**
 * Generate a raw activation token (64-char hex).
 * This is the token that appears in the activation URL.
 * It must NEVER be stored — only its hash is persisted.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a raw token for storage using SHA-256.
 * Returns a 64-char hex string.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
