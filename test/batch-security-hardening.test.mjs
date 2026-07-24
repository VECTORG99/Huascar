import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

describe('Batch security hardening (#257,#260,#264,#266,#269,#270,#279,#283)', () => {

  it('#257: errorHandler uses case-insensitive production check', () => {
    const src = fs.readFileSync('src/middleware/errorHandler.ts', 'utf8');
    assert.match(src, /toLowerCase\(\).*===.*'production'/);
    assert.doesNotMatch(src, /stack.*res/); // no stack in response
  });

  it('#257: errorHandler never includes stack in response body', () => {
    const src = fs.readFileSync('src/middleware/errorHandler.ts', 'utf8');
    assert.doesNotMatch(src, /stack.*json|json.*stack/);
  });

  it('#260: metrics token uses timing-safe comparison', () => {
    const src = fs.readFileSync('src/routes/metrics.ts', 'utf8');
    assert.match(src, /timingSafeEqual/);
  });

  it('#264: npm audit is blocking (no continue-on-error)', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    const securitySection = ci.split('security:')[1] || '';
    assert.doesNotMatch(securitySection, /continue-on-error:\s*true/);
    assert.match(securitySection, /npm audit/);
  });

  it('#269: production docker-compose does not use env_file', () => {
    const prod = fs.readFileSync('docker-compose.production.yml', 'utf8');
    assert.match(prod, /env_file:\s*\[\]/);
    assert.match(prod, /AUTH_REQUIRED=true/);
  });

  it('#279: backup script exists', () => {
    assert.ok(fs.existsSync('scripts/backup-db.sh'));
    const script = fs.readFileSync('scripts/backup-db.sh', 'utf8');
    assert.match(script, /\.backup/);
    assert.match(script, /tail.*\+8/); // rotation
  });

  it('#283: Next.js has security headers configured', () => {
    const config = fs.readFileSync('frontend/next.config.ts', 'utf8');
    assert.match(config, /X-Content-Type-Options/);
    assert.match(config, /X-Frame-Options/);
    assert.match(config, /Referrer-Policy/);
    assert.match(config, /headers\(\)/);
  });
});
