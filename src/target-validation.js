import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export async function validateTargetUrl(input, resolveHost = lookup) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid product URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The product URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not supported.");
  }

  if (process.env.ALLOW_PRIVATE_TARGETS !== "true") {
    const addresses = await resolveHost(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("Private, local, and reserved network targets are disabled.");
    }
  }
  return url.toString();
}

export function isPrivateAddress(address) {
  if (!isIP(address)) return true;
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
  if (isIP(normalized) === 6) return false;

  const [a, b] = normalized.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}
