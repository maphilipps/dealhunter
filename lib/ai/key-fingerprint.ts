import { createHash } from 'crypto';

export function fingerprintSecret(secret: string | null | undefined): string {
  if (!secret) return 'none';
  return createHash('sha256').update(secret).digest('hex').slice(0, 12);
}
