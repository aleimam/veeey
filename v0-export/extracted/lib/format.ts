export function formatEGP(amount: number): string {
  return `${amount.toLocaleString("en-US")} EGP`
}

export function formatPoints(points: number): string {
  return points.toLocaleString("en-US")
}
