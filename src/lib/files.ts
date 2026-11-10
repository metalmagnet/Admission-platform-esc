import { createHash } from 'node:crypto';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type AcceptedMime = 'application/pdf' | 'image/jpeg' | 'image/png';

// The browser-reported type and file name are not trusted; the leading bytes decide.
export function sniffMime(bytes: Uint8Array): AcceptedMime | null {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

export function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function safeName(name: string) {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'document';
}
