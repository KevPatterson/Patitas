import { describe, it, expect } from 'vitest';

// Recreate the calculateTextSimilarity function for testing
function calculateTextSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

describe('Deduplication Logic', () => {
  describe('calculateTextSimilarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'perro perdido la habana color marron';
      const result = calculateTextSimilarity(text, text);
      expect(result).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      const result = calculateTextSimilarity('perro perdido', 'gato encontrado');
      expect(result).toBe(0);
    });

    it('should calculate Jaccard similarity correctly', () => {
      // "perro perdido la habana" vs "perro encontrado la habana"
      // Words (len>2): {perro, perdido, habana} vs {perro, encontrado, habana}
      // Intersection: {perro, habana} = 2
      // Union: {perro, perdido, habana, encontrado} = 4
      // Similarity = 2/4 = 0.5
      const result = calculateTextSimilarity('perro perdido la habana', 'perro encontrado la habana');
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should ignore short words (< 3 chars)', () => {
      // "a b c" should be filtered out
      const result = calculateTextSimilarity('a b c perro', 'x y z perro');
      expect(result).toBe(1); // Only "perro" remains in both
    });

    it('should be case insensitive', () => {
      const result = calculateTextSimilarity('PERRO PERDIDO', 'perro perdido');
      expect(result).toBe(1);
    });

    it('should handle empty strings', () => {
      expect(calculateTextSimilarity('', '')).toBe(0);
      expect(calculateTextSimilarity('perro', '')).toBe(0);
      expect(calculateTextSimilarity('', 'perro')).toBe(0);
    });
  });
});

describe('Confidence Scoring', () => {
  // Recreate the calculateConfidence function for testing
  function calculateConfidence(
    classificationConfidence: number,
    extractionConfidence: Record<string, number>,
    sourceTrusted: boolean,
    hasImages: boolean,
    hasLocation: boolean
  ): number {
    const weights = {
      classification: 0.3,
      extraction: 0.3,
      sourceTrust: 0.15,
      hasImages: 0.15,
      hasLocation: 0.1,
    };
    
    const keyFields = ['species', 'color', 'province', 'municipality', 'contact_phone', 'contact_whatsapp'];
    const extractionScores = keyFields
      .map(f => extractionConfidence[f] ?? 0)
      .filter(v => v > 0);
    const avgExtraction = extractionScores.length > 0
      ? extractionScores.reduce((a, b) => a + b, 0) / extractionScores.length
      : 0;
    
    const score = 
      weights.classification * classificationConfidence +
      weights.extraction * avgExtraction +
      weights.sourceTrust * (sourceTrusted ? 1 : 0) +
      weights.hasImages * (hasImages ? 1 : 0) +
      weights.hasLocation * (hasLocation ? 1 : 0);
    
    return Math.max(0, Math.min(1, score));
  }

  it('should return 1 for perfect scores', () => {
    const result = calculateConfidence(1, { species: 1, color: 1, province: 1 }, true, true, true);
    expect(result).toBe(1);
  });

  it('should return 0 for all zeros', () => {
    const result = calculateConfidence(0, {}, false, false, false);
    expect(result).toBe(0);
  });

  it('should weight classification at 30%', () => {
    const withClassification = calculateConfidence(1, {}, false, false, false);
    const withoutClassification = calculateConfidence(0, {}, false, false, false);
    expect(withClassification - withoutClassification).toBeCloseTo(0.3, 1);
  });

  it('should weight extraction at 30%', () => {
    const withExtraction = calculateConfidence(0, { species: 1, color: 1, province: 1 }, false, false, false);
    const withoutExtraction = calculateConfidence(0, {}, false, false, false);
    expect(withExtraction - withoutExtraction).toBeCloseTo(0.3, 1);
  });

  it('should weight source trust at 15%', () => {
    const trusted = calculateConfidence(0, {}, true, false, false);
    const notTrusted = calculateConfidence(0, {}, false, false, false);
    expect(trusted - notTrusted).toBeCloseTo(0.15, 1);
  });

  it('should weight hasImages at 15%', () => {
    const withImages = calculateConfidence(0, {}, false, true, false);
    const withoutImages = calculateConfidence(0, {}, false, false, false);
    expect(withImages - withoutImages).toBeCloseTo(0.15, 1);
  });

  it('should weight hasLocation at 10%', () => {
    const withLocation = calculateConfidence(0, {}, false, false, true);
    const withoutLocation = calculateConfidence(0, {}, false, false, false);
    expect(withLocation - withoutLocation).toBeCloseTo(0.1, 1);
  });

  it('should average extraction confidence across key fields', () => {
    // Only species and color provided (2/6 key fields)
    const result = calculateConfidence(0, { species: 1, color: 0.5 }, false, false, false);
    // avgExtraction = (1 + 0.5) / 2 = 0.75
    // score = 0.3 * 0.75 = 0.225
    expect(result).toBeCloseTo(0.225, 2);
  });

  it('should ignore extraction fields with 0 confidence', () => {
    const result = calculateConfidence(0, { species: 1, color: 0, province: 0 }, false, false, false);
    // Only species counts (1/1 = 1.0)
    // score = 0.3 * 1.0 = 0.3
    expect(result).toBeCloseTo(0.3, 1);
  });

  it('should clamp result between 0 and 1', () => {
    // Even with all max values, should not exceed 1
    const result = calculateConfidence(1, { species: 1, color: 1, province: 1, municipality: 1, contact_phone: 1, contact_whatsapp: 1 }, true, true, true);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('Auto-Publish Thresholds', () => {
  // Test the auto-publish decision logic
  function shouldAutoPublish(
    confidence: number,
    sourceTrusted: boolean,
    hasImages: boolean,
    hasLocation: boolean,
    autoPublishEnabled: boolean,
    confidenceThreshold: number,
    requireTrusted: boolean,
    requireImage: boolean,
    requireLocation: boolean
  ): boolean {
    if (!autoPublishEnabled) return false;
    if (confidence < confidenceThreshold) return false;
    if (requireTrusted && !sourceTrusted) return false;
    if (requireImage && !hasImages) return false;
    if (requireLocation && !hasLocation) return false;
    return true;
  }

  it('should not auto-publish when disabled', () => {
    const result = shouldAutoPublish(1, true, true, true, false, 0.85, true, true, true);
    expect(result).toBe(false);
  });

  it('should not auto-publish when confidence below threshold', () => {
    const result = shouldAutoPublish(0.8, true, true, true, true, 0.85, true, true, true);
    expect(result).toBe(false);
  });

  it('should auto-publish when all conditions met', () => {
    const result = shouldAutoPublish(0.9, true, true, true, true, 0.85, true, true, true);
    expect(result).toBe(true);
  });

  it('should not auto-publish when source not trusted (if required)', () => {
    const result = shouldAutoPublish(0.9, false, true, true, true, 0.85, true, true, true);
    expect(result).toBe(false);
  });

  it('should auto-publish when source not trusted but not required', () => {
    const result = shouldAutoPublish(0.9, false, true, true, true, 0.85, false, true, true);
    expect(result).toBe(true);
  });

  it('should not auto-publish when no images (if required)', () => {
    const result = shouldAutoPublish(0.9, true, false, true, true, 0.85, true, true, true);
    expect(result).toBe(false);
  });

  it('should not auto-publish when no location (if required)', () => {
    const result = shouldAutoPublish(0.9, true, true, false, true, 0.85, true, true, true);
    expect(result).toBe(false);
  });

  it('should work with custom threshold', () => {
    const result = shouldAutoPublish(0.75, true, true, true, true, 0.7, true, true, true);
    expect(result).toBe(true);
  });

  it('should work without requiring images', () => {
    const result = shouldAutoPublish(0.9, true, false, true, true, 0.85, true, false, true);
    expect(result).toBe(true);
  });

  it('should work without requiring location', () => {
    const result = shouldAutoPublish(0.9, true, true, false, true, 0.85, true, true, false);
    expect(result).toBe(true);
  });
});