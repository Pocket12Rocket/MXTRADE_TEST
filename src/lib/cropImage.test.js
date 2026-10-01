import { describe, expect, it } from 'vitest';
import { LISTING_IMAGE_ASPECT, buildCroppedFileName, getOutputSize } from './cropImage';

describe('getOutputSize', () => {
  it('scales large crops down to the max width at the exact ratio', () => {
    expect(getOutputSize({ width: 3000 }, LISTING_IMAGE_ASPECT, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
  });

  it('never upscales small crops', () => {
    expect(getOutputSize({ width: 800 }, LISTING_IMAGE_ASPECT, 1600)).toEqual({
      width: 800,
      height: 600,
    });
  });

  it('keeps squares square', () => {
    expect(getOutputSize({ width: 2048.4 }, 1, 512)).toEqual({ width: 512, height: 512 });
  });
});

describe('buildCroppedFileName', () => {
  it('swaps the extension for the encoded type', () => {
    expect(buildCroppedFileName('helmet front.HEIC', 'image/webp')).toBe('helmet front.webp');
    expect(buildCroppedFileName('boots.png', 'image/jpeg')).toBe('boots.jpg');
  });

  it('handles missing names', () => {
    expect(buildCroppedFileName('', 'image/webp')).toBe('image.webp');
  });
});
