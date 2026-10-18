import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  AVATAR_MAX_SIDE,
  AVATAR_TARGET_BYTES,
  PUBLICATION_MAX_SIDE,
  PUBLICATION_TARGET_BYTES,
  hasExifBlock,
  sanitizeImage,
} from '../_lib/image-process';

/**
 * Criterio de aceptación de la Fase 3:
 *   "subir una foto con GPS en EXIF produce un archivo sin GPS; subir un SVG o un
 *    .php renombrado a .jpg se rechaza; test unitario por cada caso".
 *
 * Aquí se prueban los dos primeros sobre la función real de saneado (con sharp de
 * verdad, no un mock), y los rechazos de formato sobre `detectImage` (cubiertos
 * también en image-guard.test.ts).
 */

/** JPEG sólido con las dimensiones indicadas. */
async function jpegOf(width: number, height: number, withExif = false): Promise<Buffer> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } },
  }).jpeg({ quality: 90 });

  if (withExif) {
    pipeline = pipeline.withMetadata({
      exif: {
        IFD0: { Copyright: 'Patitas test', Software: 'patitas-test' },
      },
    });
  }

  return pipeline.toBuffer();
}

/**
 * Construye un JPEG con un bloque APP1 que declara EXIF y contiene el puntero al
 * IFD de GPS (tag 0x8825 little-endian). Es exactamente lo que detecta
 * `containsGpsMetadata`.
 */
function jpegWithGps(): Buffer {
  const header = Buffer.from([0xff, 0xd8]); // SOI
  const app1 = Buffer.from([0xff, 0xe1, 0x00, 0x10]); // APP1, longitud 16
  const exif = Buffer.from('Exif\u0000\u0000', 'latin1');
  const gpsPointer = Buffer.from([0x25, 0x88, 0x00, 0x00]); // tag GPSInfoIFDPointer
  const gpsText = Buffer.from('GPSLatitude', 'latin1');
  const filler = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0x64, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01]);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([header, app1, exif, gpsPointer, gpsText, filler, sof, eoi]);
}

describe('hasExifBlock', () => {
  it('detecta un bloque EXIF generado por sharp', async () => {
    const withExif = await jpegOf(64, 64, true);
    expect(hasExifBlock(new Uint8Array(withExif))).toBe(true);
  });

  it('no marca una imagen sin EXIF', async () => {
    const clean = await jpegOf(64, 64, false);
    expect(hasExifBlock(new Uint8Array(clean))).toBe(false);
  });
});

describe('sanitizeImage — foto con GPS', () => {
  it('RECHAZA la imagen si lleva GPS en EXIF', async () => {
    const result = await sanitizeImage(new Uint8Array(jpegWithGps()), 'publication');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GPS_METADATA');
      expect(result.reason).toMatch(/ubicación GPS/i);
    }
  });

  it('una foto con EXIF pero SIN GPS sí se acepta y sale sin metadatos', async () => {
    const input = await jpegOf(800, 600, true);

    expect(hasExifBlock(new Uint8Array(input))).toBe(true);

    const result = await sanitizeImage(new Uint8Array(input), 'publication');

    expect(result.ok).toBe(true);

    if (result.ok) {
      // El original tenía EXIF: se informa a la UI.
      expect(result.hadMetadata).toBe(true);

      // El resultado es WebP y NO arrastra el bloque EXIF.
      expect(result.mimeType).toBe('image/webp');
      expect(hasExifBlock(new Uint8Array(result.bytes))).toBe(false);

      // Y sharp lo confirma: no hay EXIF en la salida.
      const metadata = await sharp(result.bytes).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.exif).toBeUndefined();
    }
  });
});

describe('sanitizeImage — formato y tamaño', () => {
  it('RECHAZA un SVG', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const result = await sanitizeImage(new Uint8Array(svg), 'publication');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/SVG/);
  });

  it('RECHAZA un .php renombrado a .jpg', async () => {
    const php = Buffer.from('<?php system($_GET["cmd"]); ?>');
    const result = await sanitizeImage(new Uint8Array(php), 'publication');

    expect(result.ok).toBe(false);
  });

  it('RECHAZA un GIF', async () => {
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00]);
    const result = await sanitizeImage(new Uint8Array(gif), 'publication');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/GIF/);
  });

  it('reduce el lado largo a 1600 px como máximo', async () => {
    const input = await jpegOf(3000, 1200);
    const result = await sanitizeImage(new Uint8Array(input), 'publication');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Math.max(result.width ?? 0, result.height ?? 0)).toBeLessThanOrEqual(PUBLICATION_MAX_SIDE);
      expect(result.outputBytes).toBeLessThanOrEqual(PUBLICATION_TARGET_BYTES);
    }
  });

  it('no amplía una imagen pequeña', async () => {
    const input = await jpegOf(320, 240);
    const result = await sanitizeImage(new Uint8Array(input), 'publication');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
    }
  });

  it('para avatares aplica 512 px y 300 KB', async () => {
    const input = await jpegOf(2000, 2000);
    const result = await sanitizeImage(new Uint8Array(input), 'avatar');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Math.max(result.width ?? 0, result.height ?? 0)).toBeLessThanOrEqual(AVATAR_MAX_SIDE);
      expect(result.outputBytes).toBeLessThanOrEqual(AVATAR_TARGET_BYTES);
    }
  });

  it('acepta PNG y lo convierte a WebP', async () => {
    const png = await sharp({
      create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    const result = await sanitizeImage(new Uint8Array(png), 'publication');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mimeType).toBe('image/webp');
  });

  it('acepta WebP de entrada', async () => {
    const webp = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#abc' },
    })
      .webp()
      .toBuffer();

    const result = await sanitizeImage(new Uint8Array(webp), 'publication');

    expect(result.ok).toBe(true);
  });
});
