import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('RAG knowledge source injection prevention (issue #284)', () => {
  // Simulate the filtering logic from HuascarEngine
  function filterClientSources(sources) {
    return sources.filter(source => source.type === 'inline');
  }

  it('allows inline sources from client', () => {
    const sources = [
      { type: 'inline', content: 'This is safe context for the LLM' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 1);
    assert.equal(safe[0].type, 'inline');
  });

  it('blocks local_file sources from client', () => {
    const sources = [
      { type: 'local_file', path: '/etc/passwd' },
      { type: 'local_file', path: '../../.env' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 0);
  });

  it('blocks local_directory sources from client', () => {
    const sources = [
      { type: 'local_directory', path: '/', pattern: '*.env' },
      { type: 'local_directory', path: '/home', pattern: '*.key' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 0);
  });

  it('blocks web_url sources from client (SSRF prevention)', () => {
    const sources = [
      { type: 'web_url', url: 'http://169.254.169.254/latest/meta-data/' },
      { type: 'web_url', url: 'http://internal-service:8080/secrets' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 0);
  });

  it('filters mixed sources — keeps only inline', () => {
    const sources = [
      { type: 'inline', content: 'safe context' },
      { type: 'local_file', path: '/etc/shadow' },
      { type: 'web_url', url: 'http://evil.com' },
      { type: 'inline', content: 'also safe' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 2);
    assert.equal(safe[0].content, 'safe context');
    assert.equal(safe[1].content, 'also safe');
  });

  it('handles empty knowledge array', () => {
    const safe = filterClientSources([]);
    assert.equal(safe.length, 0);
  });

  it('blocks unknown source types', () => {
    const sources = [
      { type: 'ftp_url', url: 'ftp://server/file' },
      { type: 'ssh', path: 'user@host:/file' }
    ];
    const safe = filterClientSources(sources);
    assert.equal(safe.length, 0);
  });
});
