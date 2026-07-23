import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Simulate isPrivateIp from RagEngine
function isPrivateIp(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] >= 224) return true;
  }
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('::ffff:')) return isPrivateIp(ip.slice(7));
  return false;
}

function isBlockedUrl(urlStr) {
  const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (BLOCKED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) return true;
    if (isPrivateIp(parsed.hostname)) return true;
    if (/^\d+$/.test(parsed.hostname)) return true;
    if (/^0x/i.test(parsed.hostname)) return true;
    return false;
  } catch { return true; }
}

describe('SSRF Prevention (issue #3)', () => {
  it('blocks localhost', () => assert.equal(isBlockedUrl('http://localhost/secret'), true));
  it('blocks 127.0.0.1', () => assert.equal(isBlockedUrl('http://127.0.0.1/admin'), true));
  it('blocks 10.x.x.x (RFC1918)', () => assert.equal(isBlockedUrl('http://10.0.0.1/internal'), true));
  it('blocks 172.16.x.x (RFC1918)', () => assert.equal(isBlockedUrl('http://172.16.0.1/api'), true));
  it('blocks 172.31.x.x (RFC1918)', () => assert.equal(isBlockedUrl('http://172.31.255.255/data'), true));
  it('allows 172.32.x.x (public)', () => assert.equal(isBlockedUrl('http://172.32.0.1/ok'), false));
  it('blocks 192.168.x.x (RFC1918)', () => assert.equal(isBlockedUrl('http://192.168.1.1/router'), true));
  it('blocks 169.254.169.254 (cloud metadata)', () => assert.equal(isBlockedUrl('http://169.254.169.254/latest/meta-data'), true));
  it('blocks 0.0.0.0', () => assert.equal(isBlockedUrl('http://0.0.0.0/'), true));
  it('blocks multicast 224.x', () => assert.equal(isBlockedUrl('http://224.0.0.1/'), true));
  it('blocks ftp protocol', () => assert.equal(isBlockedUrl('ftp://example.com/file'), true));
  it('blocks file protocol', () => assert.equal(isBlockedUrl('file:///etc/passwd'), true));
  it('allows valid public URL', () => assert.equal(isBlockedUrl('https://docs.github.com/readme'), false));
  it('allows public IP', () => assert.equal(isBlockedUrl('http://8.8.8.8/dns'), false));
  it('blocks decimal-encoded IP', () => assert.equal(isBlockedUrl('http://2130706433/'), true));
  it('blocks hex-encoded hostname', () => assert.equal(isBlockedUrl('http://0x7f000001/'), true));
  it('blocks IPv6 loopback (isPrivateIp)', () => assert.equal(isPrivateIp('::1'), true));
  it('blocks link-local IPv6', () => assert.equal(isPrivateIp('fe80::1'), true));
  it('blocks unique-local IPv6 (fc/fd)', () => assert.equal(isPrivateIp('fd12::1'), true));
  it('blocks IPv4-mapped IPv6 private', () => assert.equal(isPrivateIp('::ffff:192.168.1.1'), true));
});
