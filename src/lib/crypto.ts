import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const FALLBACK_SECRET =
  "dmb-dev-only-pii-key::ganti-di-production::2026::aes-256-gcm";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.PII_ENCRYPTION_KEY || FALLBACK_SECRET;
  cachedKey = crypto.scryptSync(secret, "dmb-screening-pii", 32);
  return cachedKey;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(PREFIX));
}

export function encryptPII(value: string | null | undefined): string {
  if (!value) return "";
  if (isEncrypted(value)) return value;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptPII(value: string | null | undefined): string {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  try {
    const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split(":");
    const key = getKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskNIK(value: string | null | undefined): string {
  const plain = decryptPII(value).replace(/\s/g, "");
  if (!plain) return "—";
  if (plain.length <= 8) return `${plain.slice(0, 2)}••••${plain.slice(-2)}`;
  return `${plain.slice(0, 4)} •••• •••• ${plain.slice(-4)}`;
}

export function maskAccount(value: string | null | undefined): string {
  const plain = decryptPII(value).replace(/\s/g, "");
  if (!plain) return "—";
  if (plain.length <= 4) return `•••• ${plain}`;
  return `•••• •••• ${plain.slice(-4)}`;
}

export function digitsOnly(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
