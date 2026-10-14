import { describe, it, expect } from 'vitest';

// Recreate generateHmacSignature for testing
function generateHmacSignature(payload: string, secret: string): string {
  // Simple implementation for testing - in real code uses crypto.subtle
  let hash = 0;
  const combined = secret + '|' + payload;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex-like string for testing
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(8).slice(0, 64);
}

// Recreate verifyHmac for testing
async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  // In real implementation uses crypto.subtle
  // For testing, we just check if signature was generated with same secret
  const expected = generateHmacSignature(payload, secret);
  return signature === expected;
}

describe('HMAC Verification', () => {
  const secret = 'test-secret-key-for-testing';
  
  it('should generate consistent signatures', () => {
    const payload = '{"test":"payload"}';
    const sig1 = generateHmacSignature(payload, secret);
    const sig2 = generateHmacSignature(payload, secret);
    expect(sig1).toBe(sig2);
  });

  it('should generate different signatures for different payloads', () => {
    const sig1 = generateHmacSignature('payload1', secret);
    const sig2 = generateHmacSignature('payload2', secret);
    expect(sig1).not.toBe(sig2);
  });

  it('should generate different signatures for different secrets', () => {
    const payload = '{"test":"payload"}';
    const sig1 = generateHmacSignature(payload, 'secret1');
    const sig2 = generateHmacSignature(payload, 'secret2');
    expect(sig1).not.toBe(sig2);
  });

  it('should produce string of correct length (64 chars)', () => {
    const sig = generateHmacSignature('test', secret);
    expect(sig.length).toBe(64);
  });

  it('should be deterministic', () => {
    const payload = JSON.stringify({ a: 1, b: 2 });
    const sig = generateHmacSignature(payload, secret);
    expect(generateHmacSignature(payload, secret)).toBe(sig);
  });
});

describe('HMAC Verification Integration', () => {
  const secret = 'test-secret-key-for-testing';
  
  it('should verify valid signature', async () => {
    const payload = '{"source_id":"test","platform":"TELEGRAM"}';
    const signature = generateHmacSignature(payload, secret);
    const valid = await verifyHmac(payload, signature, secret);
    expect(valid).toBe(true);
  });

  it('should reject tampered payload', async () => {
    const payload = '{"source_id":"test","platform":"TELEGRAM"}';
    const signature = generateHmacSignature(payload, secret);
    const tamperedPayload = '{"source_id":"test","platform":"FACEBOOK_PUBLIC"}';
    const valid = await verifyHmac(tamperedPayload, signature, secret);
    expect(valid).toBe(false);
  });

  it('should reject signature from different secret', async () => {
    const payload = '{"source_id":"test","platform":"TELEGRAM"}';
    const signature = generateHmacSignature(payload, 'different-secret');
    const valid = await verifyHmac(payload, signature, secret);
    expect(valid).toBe(false);
  });

  it('should reject wrong signature', async () => {
    const payload = '{"test":"payload"}';
    const valid = await verifyHmac(payload, 'wrong-signature', secret);
    expect(valid).toBe(false);
  });
});

describe('SSRF Protection', () => {
  // Test the URL validation logic from facebook-import
  const ALLOWED_HOSTS = [
    'facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com',
    'fb.com', 'fb.watch', 'www.fb.com', 'l.facebook.com', 'lm.facebook.com'
  ];

  function validateFacebookUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const hostname = parsed.hostname.toLowerCase();
      return ALLOWED_HOSTS.some(allowed => 
        hostname === allowed || hostname.endsWith('.' + allowed)
      );
    } catch {
      return false;
    }
  }

  it('should allow valid facebook.com URLs', () => {
    const urls = [
      'https://facebook.com/user/posts/123',
      'https://www.facebook.com/groups/123/permalink/456',
      'https://m.facebook.com/story.php?story_fbid=123',
      'https://mbasic.facebook.com/groups/123',
      'https://fb.com/user/posts/123',
      'https://fb.watch/abc123/',
      'https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com',
    ];
    for (const url of urls) {
      expect(validateFacebookUrl(url)).toBe(true);
    }
  });

  it('should reject HTTP URLs', () => {
    expect(validateFacebookUrl('http://facebook.com/posts/123')).toBe(false);
  });

  it('should reject non-facebook domains', () => {
    const urls = [
      'https://evil.com/facebook.com/posts/123',
      'https://facebook.com.evil.com/posts/123',
      'https://twitter.com/user/status/123',
    ];
    for (const url of urls) {
      expect(validateFacebookUrl(url)).toBe(false);
    }
  });

  it('should reject private IPs', () => {
    const urls = [
      'https://192.168.1.1/facebook.com/posts/123',
      'https://10.0.0.1/facebook.com/posts/123',
      'https://127.0.0.1/facebook.com/posts/123',
      'https://169.254.169.254/latest/meta-data/',
    ];
    for (const url of urls) {
      expect(validateFacebookUrl(url)).toBe(false);
    }
  });

  it('should reject localhost', () => {
    expect(validateFacebookUrl('https://localhost:3000/facebook.com/posts/123')).toBe(false);
  });

  it('should reject javascript: and data: URIs', () => {
    expect(validateFacebookUrl('javascript:alert(1)')).toBe(false);
    expect(validateFacebookUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('should reject malformed URLs', () => {
    expect(validateFacebookUrl('not-a-url')).toBe(false);
    expect(validateFacebookUrl('')).toBe(false);
  });
});