import { describe, it, expect } from 'vitest'; 
import { 
  facebookLinkImportSchema, 
  extractOpenGraphMetadata,
  extractPostText,
  extractPostImages,
  isFacebookBoilerplate,
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

    it('decodifica las entidades de la URL de la imagen', () => {
      // Facebook devuelve `&amp;` en las URL firmadas de su CDN. Sin decodificar,
      // la imagen no se puede descargar ni mostrar.
      const html = `
        <meta property="og:image" content="https://scontent.xx.fbcdn.net/foto.jpg?stp=dst-jpg&amp;cstp=mx998x570&amp;oe=6AE3E88C" />
      `;

      const result = extractOpenGraphMetadata(html);

      expect(result.image).toBe(
        'https://scontent.xx.fbcdn.net/foto.jpg?stp=dst-jpg&cstp=mx998x570&oe=6AE3E88C'
      );
    });

    it('acepta meta etiquetas con content antes de property', () => {
      const html = `
        <meta content="Perro perdido en Holguín" property="og:title" />
        <meta content="https://example.com/dog.jpg" property="og:image" />
      `;

      const result = extractOpenGraphMetadata(html);

      expect(result.title).toBe('Perro perdido en Holguín');
      expect(result.image).toBe('https://example.com/dog.jpg');
    });
  });

  describe('extractPostText', () => {
    it('extrae el mensaje del post y lo convierte a texto plano', () => {
      const html = `
        <div data-ad-preview="message" class="x1yztbdb">
          Perro perdido en Centro Habana.<br />
          Llama al 55512345 &amp; pregunta por Ana.
        </div>
      `;

      expect(extractPostText(html)).toBe(
        'Perro perdido en Centro Habana.\nLlama al 55512345 & pregunta por Ana.'
      );
    });

    it('extrae el mensaje del JSON embebido', () => {
      const html = `<script>{"message":{"text":"Gata encontrada en Vedado\\nWhatsApp 55512345"}}</script>`;

      expect(extractPostText(html)).toBe('Gata encontrada en Vedado WhatsApp 55512345');
    });

    it('devuelve null si no hay mensaje', () => {
      expect(extractPostText('<html><head></head></html>')).toBeNull();
    });
  });

  describe('extractPostImages', () => {
    it('prioriza la foto adjunta sobre la portada del grupo', () => {
      const html = `
        <meta property="og:image" content="https://scontent.xx.fbcdn.net/v/cover.jpg?stp=dst-jpg&amp;oe=AA" />
        <script type="application/json">{"group":{"cover_photo":{"uri":"https:\\/\\/scontent.xx.fbcdn.net\\/v\\/cover.jpg?stp=dst-jpg&oe=AA"}},"attachments":[{"media":{"photo_image":{"uri":"https:\\/\\/scontent.xx.fbcdn.net\\/v\\/post.jpg?stp=dst-jpg\\u0026oe=CC"}}}]}</script>
      `;

      const images = extractPostImages(html);

      expect(images[0]).toBe(
        'https://scontent.xx.fbcdn.net/v/post.jpg?stp=dst-jpg&oe=CC'
      );
    });

    it('descarta avatares y fotos de perfil del grupo', () => {
      const html = `
        <script type="application/json">{"profile_picture_image":{"uri":"https:\\/\\/scontent.xx.fbcdn.net\\/v\\/perfil.jpg?stp=dst-jpg&oe=AA"}}</script>
      `;

      expect(extractPostImages(html)).toEqual([]);
    });

    it('descarta miniaturas demasiado pequeñas', () => {
      const html = `
        <script type="application/json">{"image":{"uri":"https:\\/\\/scontent.xx.fbcdn.net\\/v\\/logo.jpg?stp=dst-jpg_s160x160&oe=AA"}}</script>
      `;

      expect(extractPostImages(html)).toEqual([]);
    });

    it('extrae imágenes del div del mensaje', () => {
      const html = `
        <div data-ad-preview="message">
          <img src="https://scontent.xx.fbcdn.net/v/foto.jpg?stp=dst-jpg&amp;oe=AA" />
        </div>
      `;

      expect(extractPostImages(html)).toEqual([
        'https://scontent.xx.fbcdn.net/v/foto.jpg?stp=dst-jpg&oe=AA',
      ]);
    });
  });

  describe('isFacebookBoilerplate', () => {
    it('detecta los textos genéricos de Facebook', () => {
      expect(isFacebookBoilerplate('Facebook')).toBe(true);
      expect(isFacebookBoilerplate('See posts, photos and more on Facebook.')).toBe(true);
      expect(isFacebookBoilerplate('Ver publicaciones, fotos y mucho más en Facebook.')).toBe(true);
      expect(isFacebookBoilerplate('Inicia sesión en Facebook')).toBe(true);
      expect(isFacebookBoilerplate(null)).toBe(true);
    });

    it('no descarta el texto real del aviso', () => {
      expect(isFacebookBoilerplate('Perro perdido en La Habana')).toBe(false);
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