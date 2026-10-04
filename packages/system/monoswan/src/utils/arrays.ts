export type AtLeastOneArray<T> = [T, ...T[]];

export function isAtLeastOneArray<T>(arr: T[]): arr is AtLeastOneArray<T> {
  return arr.length > 0;
}
