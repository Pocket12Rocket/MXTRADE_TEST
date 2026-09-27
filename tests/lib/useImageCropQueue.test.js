import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useImageCropQueue } from '../../lib/useImageCropQueue';

const image = (name) => new File(['x'], name, { type: 'image/png' });

describe('useImageCropQueue', () => {
  it('walks picked images one at a time with a progress label', () => {
    const onCropped = vi.fn();
    const { result } = renderHook(() => useImageCropQueue(onCropped));
    const [a, b] = [image('a.png'), image('b.png')];

    act(() => result.current.enqueue([a, new File(['x'], 'notes.txt', { type: 'text/plain' }), b]));
    expect(result.current.currentFile).toBe(a);
    expect(result.current.progressLabel).toBe('1 of 2');

    const cropped = image('a.webp');
    act(() => result.current.confirm(cropped));
    expect(onCropped).toHaveBeenCalledWith(cropped);
    expect(result.current.currentFile).toBe(b);
    expect(result.current.progressLabel).toBe('2 of 2');

    act(() => result.current.skip());
    expect(result.current.currentFile).toBeNull();
    expect(result.current.progressLabel).toBe('');
    expect(onCropped).toHaveBeenCalledTimes(1);
  });

  it('shows no label for a single image', () => {
    const { result } = renderHook(() => useImageCropQueue(vi.fn()));
    act(() => result.current.enqueue([image('a.png')]));
    expect(result.current.progressLabel).toBe('');
  });
});
