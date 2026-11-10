import { describe, expect, it } from 'vitest';
import { safeName, sniffMime } from './files';

describe('upload validation', () => {
  it('recognises PDF, JPEG and PNG by their leading bytes', () => {
    expect(sniffMime(new TextEncoder().encode('%PDF-1.7 rest'))).toBe('application/pdf');
    expect(sniffMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
  });

  it('rejects a script renamed to .pdf', () => {
    expect(sniffMime(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  });

  it('rejects empty input', () => {
    expect(sniffMime(new Uint8Array())).toBeNull();
  });

  it('strips path characters from file names', () => {
    expect(safeName('../../etc/passwd')).toBe('.._.._etc_passwd');
  });
});
