const SHA256_CONTENT_HASH_PATTERN = /^sha256:([0-9a-f]{64})$/i;

export function normalizeMediaAssetContentHash(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = SHA256_CONTENT_HASH_PATTERN.exec(value.trim());
  return match ? `sha256:${match[1].toLowerCase()}` : undefined;
}
