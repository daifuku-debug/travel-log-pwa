import { normalizeMediaAssetContentHash } from '../../domain/media/mediaAssetContentHash.ts';
import { AppError } from '../../shared/errors.ts';

export interface ContentHasher {
  sha256(blob: Blob): Promise<string>;
}

export const webCryptoContentHasher: ContentHasher = {
  async sha256(blob) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new AppError('この端末では写真の重複確認を利用できません。');
    const digest = await subtle.digest('SHA-256', await blob.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const contentHash = normalizeMediaAssetContentHash(`sha256:${hex}`);
    if (!contentHash) throw new AppError('写真の識別情報を作成できませんでした。');
    return contentHash;
  },
};
