/** "Áo len gân" → "AO LEN GAN" (ASCII, upper case) for building SKUs. */
function ascii(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim();
}

/** Product prefix: initials of up to 4 words ("Áo len gân thử" → "ALGT"). */
export function skuPrefix(productName: string) {
  const words = ascii(productName).split(/\s+/).filter(Boolean);
  return words.slice(0, 4).map((w) => w[0]).join("") || "SP";
}

/** Option value code, same rule as the seed: one word → 2 letters, otherwise initials ("Hoạ tiết sen" → "HTS"). */
export function valueCode(value: string) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  return words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("");
}

export function buildSku(productName: string, values: string[]) {
  return [skuPrefix(productName), ...values.map(valueCode).filter(Boolean)].join("-");
}
