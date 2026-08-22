export function blurCoordinate(value: number, seed: number, precision = 0.003): number {
  const wave = Math.sin(seed * 12.9898) * 43758.5453;
  const normalized = wave - Math.floor(wave);
  const offset = (normalized - 0.5) * precision;
  return Number((value + offset).toFixed(6));
}
