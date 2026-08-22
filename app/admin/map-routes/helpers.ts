export function uniquePush(target: Array<[number, number]>, next: [number, number], tolerance = 0.00003) {
  const prev = target[target.length - 1];
  if (!prev) {
    target.push(next);
    return;
  }
  const same = Math.abs(prev[0] - next[0]) <= tolerance && Math.abs(prev[1] - next[1]) <= tolerance;
  if (!same) target.push(next);
}

export function trimSuffixBySegment(
  source: Array<[number, number]>,
  suffix: Array<[number, number]>,
  tolerance = 0.0001,
): Array<[number, number]> {
  if (!source.length || !suffix.length || source.length <= suffix.length) return source;
  const start = source.length - suffix.length;
  const matches = suffix.every((point, index) => {
    const candidate = source[start + index];
    return (
      Math.abs(candidate[0] - point[0]) <= tolerance && Math.abs(candidate[1] - point[1]) <= tolerance
    );
  });
  if (!matches) return source;
  return source.slice(0, start);
}

export function mergeSegments(...segments: Array<Array<[number, number]>>): Array<[number, number]> {
  const merged: Array<[number, number]> = [];
  for (const segment of segments) {
    for (const point of segment) uniquePush(merged, point);
  }
  return merged;
}
