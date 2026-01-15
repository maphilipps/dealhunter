import argon2 from 'argon2'

/**
 * Hash password using Argon2id (OWASP 2025 recommended)
 * Configuration: 19MiB memory, 2 iterations, parallelism 1
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1
  })
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return argon2.verify(hash, password)
}
