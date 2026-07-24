/**
 * Shared SSRF prevention utilities.
 * Validates URLs against blocked hosts, private IPs, and dangerous protocols.
 */

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  '::ffff:127.0.0.1',
  '::ffff:0.0.0.0',
  '169.254.169.254',
  'metadata.google.internal',
  '::ffff:a9fe:a9fe',
  'metadata.internal',
  'kubernetes.default.svc',
];

/**
 * Check if an IP address is in a private/reserved range.
 * Covers: loopback, private (RFC1918), link-local, multicast, cloud metadata.
 */
export function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => p >= 0 && p <= 255)) {
    const [p0 = -1, p1 = -1] = parts;
    if (p0 === 127) return true;
    if (p0 === 10) return true;
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
    if (p0 === 192 && p1 === 168) return true;
    if (p0 === 169 && p1 === 254) return true;
    if (p0 === 0) return true;
    if (p0 >= 224) return true;
  }
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }
  if (ip.startsWith('::ffff:')) {
    return isPrivateIp(ip.slice(7));
  }
  return false;
}

/**
 * Check whether a URL should be blocked for SSRF prevention.
 * Returns true if the URL is dangerous (private IP, blocked host, non-HTTP protocol).
 */
export function isBlockedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    if (BLOCKED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) return true;
    if (isPrivateIp(parsed.hostname)) return true;
    if (/^\d+$/.test(parsed.hostname)) return true;
    if (/^0x/i.test(parsed.hostname)) return true;
    return false;
  } catch {
    return true;
  }
}
