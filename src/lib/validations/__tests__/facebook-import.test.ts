import { describe, it, expect } from 'vitest';
import { 
  facebookLinkImportSchema, 
  extractOpenGraphMetadata,
  FACEBOOK_IMPORT_CONSTANTS 
} from '../facebook-import';

describe('Facebook Import Validation', () => {
  describe('facebookLinkImportSchema', () => {
    it('should accept valid facebook.com URLs', () => {
      const validUrls = [
        'https://facebook.com/user/posts/123',
        'https://www.facebook.com/groups/123/permalink/456',
        'https://facebook.com/photo.php?fbid=123',
      ];
      
      for (const url of validUrls) {
        const result = facebookLinkImportSchema.safeParse({ url });
        expect(result.success).toBe(true);
      }
    });

    it('should accept valid fb.com URLs', () => {
      const result = facebookLinkImportSchema.safeParse({ 
        url: 'https://fb.com/user/posts/123' 
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid fb.watch URLs', () => {
      const result = facebookLinkImportSchema.safeParse({ 
        url: 'https://fb.watch/abc123/' 
      });
      expect(result.success).toBe(true);
    });

    it('should accept m.facebook.com and mbasic.facebook.com', () => {
      const urls = [
        'https://m.facebook.com/story.php?story_fbid=123',
        'https://mbasic.facebook.com/groups/123',
      ];
      
      for (const url of urls) {
        const result = facebookLinkImportSchema.safeParse({ url });
        expect(result.success).toBe(true);
      }
    });

    it('should reject non-facebook domains', () => {
      const invalidUrls = [
        'https://evil.com/facebook.com/posts/123',
        'https://facebook.com.evil.com/posts/123',
        'https://twitter.com/user/status/123',
        'https://instagram.com/p/123',
        'http://facebook.com/posts/123', // HTTP no permitido
        'ftp://facebook.com/posts/123',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];
      
      for (const url of invalidUrls) {
        const result = facebookLinkImportSchema.safeParse({ url });
        expect(result.success).toBe(false);
      }
    });

    it('should reject URLs with private IPs', () => {
      const privateUrls = [
        'https://192.168.1.1/posts/123',
        'https://10.0.0.1/facebook.com/posts/123',
        'https://127.0.0.1/facebook.com/posts/123',
        'https://169.254.169.254/latest/meta-data/', // AWS metadata
      ];
      
      for (const url of privateUrls) {
        const result = facebookLinkImportSchema.safeParse({ url });
        expect(result.success).toBe(false);
      }
    });

    it('should reject localhost', () => {
      const result = facebookLinkImportSchema.safeParse({ 
        url: 'https://localhost:3000/facebook.com/posts/123' 
      });
      expect(result.success).toBe(false);
    });
  });

  describe('extractOpenGraphMetadata', () => {
    it('should extract basic OG tags', () => {
      const html = `
        <html>
          <head>
            <meta property="og:title" content="Perro perdido en La Habana" />
            <meta property="og:description" content="Se busca perro mestizo color marrón" />
            <meta property="og:image" content="https://example.com/dog.jpg" />
            <meta property="og:url" content="https://facebook.com/post/123" />
          </head>
        </html>
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.title).toBe('Perro perdido en La Habana');
      expect(result.description).toBe('Se busca perro mestizo color marrón');
      expect(result.image).toBe('https://example.com/dog.jpg');
      expect(result.url).toBe('https://facebook.com/post/123');
    });

    it('should decode HTML entities', () => {
      const html = `
        <meta property="og:title" content="Perro perdido en La Habana & alrededores" />
        <meta property="og:description" content="Color marr&#243;n y blanco" />
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.title).toBe('Perro perdido en La Habana & alrededores');
      expect(result.description).toBe('Color marrón y blanco');
    });

    it('should fallback to twitter:card when OG missing', () => {
      const html = `
        <meta name="twitter:title" content="Twitter Title" />
        <meta name="twitter:description" content="Twitter Description" />
        <meta name="twitter:image" content="https://example.com/twitter.jpg" />
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.title).toBe('Twitter Title');
      expect(result.description).toBe('Twitter Description');
      expect(result.image).toBe('https://example.com/twitter.jpg');
    });

    it('should fallback to <title> tag', () => {
      const html = `
        <html>
          <head>
            <title>Title Tag Only</title>
          </head>
        </html>
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.title).toBe('Title Tag Only');
    });

    it('should fallback to meta description', () => {
      const html = `
        <meta name="description" content="Meta description fallback" />
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.description).toBe('Meta description fallback');
    });

    it('should return nulls for empty HTML', () => {
      const result = extractOpenGraphMetadata('<html><head></head></html>');
      
      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
      expect(result.image).toBeNull();
      expect(result.url).toBeNull();
    });

    it('should handle secure_url variant', () => {
      const html = `
        <meta property="og:image:secure_url" content="https://secure.example.com/dog.jpg" />
      `;
      
      const result = extractOpenGraphMetadata(html);
      
      expect(result.image).toBe('https://secure.example.com/dog.jpg');
    });
  });

  describe('FACEBOOK_IMPORT_CONSTANTS', () => {
    it('should have correct allowed hosts', () => {
      expect(FACEBOOK_IMPORT_CONSTANTS.ALLOWED_HOSTS).toContain('facebook.com');
      expect(FACEBOOK_IMPORT_CONSTANTS.ALLOWED_HOSTS).toContain('fb.watch');
      expect(FACEBOOK_IMPORT_CONSTANTS.ALLOWED_HOSTS).toContain('mbasic.facebook.com');
    });

    it('should have correct timeout', () => {
      expect(FACEBOOK_IMPORT_CONSTANTS.REQUEST_TIMEOUT_MS).toBe(8000);
    });

    it('should have correct max response size', () => {
      expect(FACEBOOK_IMPORT_CONSTANTS.MAX_RESPONSE_SIZE).toBe(2 * 1024 * 1024);
    });
  });
});