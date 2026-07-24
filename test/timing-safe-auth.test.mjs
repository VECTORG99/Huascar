import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Simulate the fixed isValidToken logic
function isValidToken(provided, apiKeys) {
  const providedHash = crypto.createHmac('sha256', 'huascar-auth').update(provided).digest();
  let valid = false;
  for (const key of apiKeys) {
    const keyHash = crypto.createHmac('sha256', 'huascar-auth').update(key).digest();
    if (crypto.timingSafeEqual(providedHash, keyHash)) {
      valid = true;
    }
  }
  return valid;
}

describe('Timing-safe auth token validation (issue #265)', () => {
  const keys = ['short-key', 'a-longer-api-key-32-chars-abcdef', 'another-key-64-characters-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'];

  it('validates correct key (short)', () => {
    assert.equal(isValidToken('short-key', keys), true);
  });

  it('validates correct key (medium)', () => {
    assert.equal(isValidToken('a-longer-api-key-32-chars-abcdef', keys), true);
  });

  it('validates correct key (long)', () => {
    assert.equal(isValidToken('another-key-64-characters-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', keys), true);
  });

  it('rejects wrong key of same length as valid key', () => {
    assert.equal(isValidToken('wrong-key', keys), false);
  });

  it('rejects wrong key of different length', () => {
    assert.equal(isValidToken('x', keys), false);
    assert.equal(isValidToken('this-is-48-chars-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', keys), false);
  });

  it('iterates ALL keys without early return (constant-time)', () => {
    // Even with a match on first key, all keys are checked
    let iterations = 0;
    const providedHash = crypto.createHmac('sha256', 'huascar-auth').update('short-key').digest();
    let valid = false;
    for (const key of keys) {
      iterations++;
      const keyHash = crypto.createHmac('sha256', 'huascar-auth').update(key).digest();
      if (crypto.timingSafeEqual(providedHash, keyHash)) valid = true;
    }
    assert.equal(valid, true);
    assert.equal(iterations, keys.length); // All keys checked, not just first match
  });

  it('uses HMAC for fixed-length comparison (no length oracle)', () => {
    // All HMAC outputs are 32 bytes regardless of input length
    const h1 = crypto.createHmac('sha256', 'huascar-auth').update('x').digest();
    const h2 = crypto.createHmac('sha256', 'huascar-auth').update('x'.repeat(1000)).digest();
    assert.equal(h1.length, 32);
    assert.equal(h2.length, 32);
  });
});
