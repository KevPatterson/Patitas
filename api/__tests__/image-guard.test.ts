import { describe, expect, it } from 'vitest';
import {
  detectImage,
  containsGpsMetadata,
  MAX_IMAGE_BYTES,
  toImagePayload,
} from '../_lib/image-guard';

/**
 * Hallazgos de la Fase 3 adelantados en la Fase 1 (el endpoint de capturas
 * confiaba en `file.type`):
 *
 *   - el MIME lo envía el cliente y se puede falsificar,
 *   - un SVG es XML y puede llevar `<script>`,
 *   - un `.php` renombrado a `.jpg` no es una imagen.
 *
 * La validación aquí es por magic bytes. Estos tests cubren cada caso del
 * criterio de aceptación.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG mínimo con IHDR válido (ancho y alto indicados). */
function pngBytes(width = 800, height = 600): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set(PNG_SIGNATURE, 0);

  // Longitud del chunk IHDR = 13
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  // "IHDR"
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);

  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);

  return bytes;
}

/** JPEG mínimo: SOI + APP0 + SOF0 con dimensiones. */
function jpegBytes(width = 640, height = 480): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0xff, 0xd8], 0); // SOI
  bytes.set([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00], 2); // APP0 vacío
  bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08], 8); // SOF0, len 17, precisión 8
  bytes.set([(height >> 8) & 0xff, height & 0xff], 13);
  bytes.set([(width >> 8) & 0xff, width & 0xff], 15);
  return bytes;
}

/** WebP mínimo en formato VP8X. */
function webpBytes(width = 1024, height = 768): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  bytes.set([0x00, 0x00, 0x00, 0x00], 4); // tamaño (irrelevante para el test)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X

  // Dimensiones guardadas como (valor - 1) en 24 bits little-endian.
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff], 24);
  bytes.set([h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 27);

  return bytes;
}

function textBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('detectImage (magic bytes)', () => {
  it('acepta JPEG', () => {
    const result = detectImage(jpegBytes());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
    }
  });

  it('acepta PNG', () => {
    const result = detectImage(pngBytes());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    }
  });

  it('acepta WebP', () => {
    const result = detectImage(webpBytes());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/webp');
    }
  });

  it('rechaza SVG (puede contener script)', () => {
    const svg = textBytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const result = detectImage(svg);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('SVG');
  });

  it('rechaza GIF', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
    const result = detectImage(gif);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('GIF');
  });

  it('rechaza un .php renombrado a .jpg (se valida el contenido, no el nombre)', () => {
    const php = textBytes('<?php system($_GET["cmd"]); ?>');
    const result = detectImage(php);

    expect(result.ok).toBe(false);
  });

  it('rechaza un archivo vacío', () => {
    expect(detectImage(new Uint8Array(0)).ok).toBe(false);
  });

  it('rechaza aleatorio que no es imagen', () => {
    const random = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    expect(detectImage(random).ok).toBe(false);
  });

  it('rechaza imágenes que superan el tamaño máximo del bucket', () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(PNG_SIGNATURE, 0);

    const result = detectImage(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('supera');
  });

  it('rechaza dimensiones desproporcionadas', () => {
    const huge = pngBytes(12000, 100);
    const result = detectImage(huge);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('demasiado grande');
  });

  it('respeta un límite menor (avatares)', () => {
    const bytes = new Uint8Array(3 * 1024 * 1024);
    bytes.set(PNG_SIGNATURE, 0);

    expect(detectImage(bytes, 2 * 1024 * 1024).ok).toBe(false);
  });
});

describe('toImagePayload', () => {
  it('construye el payload que consume el proveedor de IA', () => {
    const result = toImagePayload(pngBytes(), 'https://ejemplo.com/foto.png');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.image.mimeType).toBe('image/png');
      expect(result.image.sourceUrl).toBe('https://ejemplo.com/foto.png');
      expect(result.image.bytes.length).toBeGreaterThan(0);
    }
  });

  it('devuelve el motivo cuando el contenido no es válido', () => {
    const result = toImagePayload(textBytes('<svg></svg>'));
    expect(result.ok).toBe(false);
  });
});

describe('containsGpsMetadata', () => {
  it('no marca una imagen sin EXIF', () => {
    expect(containsGpsMetadata(pngBytes())).toBe(false);
  });

  it('detecta un bloque EXIF con datos GPS', () => {
    // APP1 + "Exif" + marca GPS dentro de los primeros bytes.
    const parts = [
      new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10]),
      textBytes('Exif\u0000\u0000'),
      // tag 0x8825 (GPS IFD pointer) en little-endian
      new Uint8Array([0x25, 0x88, 0x00, 0x00]),
      textBytes('GPSLatitude'),
    ];

    const total = parts.reduce((n, p) => n + p.length, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }

    expect(containsGpsMetadata(bytes)).toBe(true);
  });
});
