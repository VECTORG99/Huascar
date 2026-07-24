import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedUrl, isPrivateIp } from '../src/security/urlValidation.js';

describe('Shared URL validation (src/security/urlValidation.ts)', () => {
  it('blocks private IPs', () => {
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('172.16.0.1'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
    assert.equal(isPrivateIp('169.254.169.254'), true);
    assert.equal(isPrivateIp('0.0.0.0'), true);
    assert.equal(isPrivateIp('224.0.0.1'), true);
  });

  it('allows public IPs', () => {
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateIp('203.0.113.1'), false);
    assert.equal(isPrivateIp('172.32.0.1'), false);
  });

  it('blocks IPv6 private addresses', () => {
    assert.equal(isPrivateIp('::1'), true);
    assert.equal(isPrivateIp('fe80::1'), true);
    assert.equal(isPrivateIp('fc00::1'), true);
    assert.equal(isPrivateIp('fd00::1'), true);
  });

  it('blocks IPv4-mapped IPv6', () => {
    assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
    assert.equal(isPrivateIp('::ffff:10.0.0.1'), true);
  });

  it('blocks dangerous URLs', () => {
    assert.equal(isBlockedUrl('http://localhost:3000'), true);
    assert.equal(isBlockedUrl('http://127.0.0.1/path'), true);
    assert.equal(isBlockedUrl('http://169.254.169.254/latest/meta-data'), true);
    assert.equal(isBlockedUrl('ftp://example.com/file'), true);
    assert.equal(isBlockedUrl('file:///etc/passwd'), true);
    assert.equal(isBlockedUrl('http://0x7f000001'), true);
    assert.equal(isBlockedUrl('http://2130706433'), true);
    assert.equal(isBlockedUrl('not-a-url'), true);
  });

  it('allows valid public URLs', () => {
    assert.equal(isBlockedUrl('https://api.example.com/webhook'), false);
    assert.equal(isBlockedUrl('https://hooks.slack.com/services/T00/B00/xxxx'), false);
    assert.equal(isBlockedUrl('http://203.0.113.50:8080/hook'), false);
  });
});
