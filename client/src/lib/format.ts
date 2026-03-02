const FRACTIONS: [number, string][] = [
  [1 / 8, "⅛"],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [3 / 8, "⅜"],
  [1 / 2, "½"],
  [5 / 8, "⅝"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [7 / 8, "⅞"],
];

export function formatQty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num <= 0) return "";

  const whole = Math.floor(num);
  const remainder = num - whole;

  if (remainder < 0.01) {
    return whole === 0 ? "" : String(whole);
  }

  let fracStr = "";
  let closestDiff = Infinity;
  for (const [fracVal, fracChar] of FRACTIONS) {
    const diff = Math.abs(remainder - fracVal);
    if (diff < closestDiff) {
      closestDiff = diff;
      fracStr = fracChar;
    }
  }

  if (closestDiff > 0.05) {
    return num % 1 === 0 ? String(whole) : num.toFixed(2).replace(/\.?0+$/, "");
  }

  return whole === 0 ? fracStr : `${whole}${fracStr}`;
}
