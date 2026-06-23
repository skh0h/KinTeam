import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from './pin.js';

describe('hashPin', () => {
  it('same input yields identical hash', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).toBe(h2);
  });

  it('different inputs yield different hashes', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('0000');
    expect(h1).not.toBe(h2);
  });

  it('output is a hex string', async () => {
    const hash = await hashPin('1234');
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

describe('verifyPin', () => {
  it('verifyPin(p, await hashPin(p)) === true', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('verifyPin with wrong pin returns false', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('0000', hash)).toBe(false);
  });

  it('verifyPin with null hash returns false', async () => {
    expect(await verifyPin('1234', null)).toBe(false);
  });
});
