import { describe, expect, it } from 'vitest';
import { mergeSegments, trimSuffixBySegment } from '@/app/admin/map-routes/helpers';

describe('map route helper utilities', () => {
  it('trimSuffixBySegment removes a matching suffix only', () => {
    const source: Array<[number, number]> = [
      [56.1, 43.1],
      [56.2, 43.2],
      [56.3, 43.3],
      [56.4, 43.4],
    ];

    const result = trimSuffixBySegment(source, [
      [56.3, 43.3],
      [56.4, 43.4],
    ]);

    expect(result).toEqual([
      [56.1, 43.1],
      [56.2, 43.2],
    ]);
  });

  it('mergeSegments deduplicates boundary points', () => {
    const result = mergeSegments(
      [
        [56.1, 43.1],
        [56.2, 43.2],
      ],
      [
        [56.2, 43.2],
        [56.3, 43.3],
      ],
      [
        [56.3, 43.3],
        [56.4, 43.4],
      ],
    );

    expect(result).toEqual([
      [56.1, 43.1],
      [56.2, 43.2],
      [56.3, 43.3],
      [56.4, 43.4],
    ]);
  });
});
