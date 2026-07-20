import { AppError } from '../../shared/errors.ts';

export const MAX_MEDIA_FILE_BYTES = 12 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export interface DecodedMediaImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export interface MediaImageProcessor {
  decode: (file: File) => Promise<DecodedMediaImage>;
  createThumbnail: (image: DecodedMediaImage, mimeType: string) => Promise<Blob>;
}

export interface PreparedMediaImage {
  file: File;
  mimeType: string;
  width: number;
  height: number;
  thumbnailBlob: Blob;
}

export function resolveImageMimeType(file: File): string {
  const declaredType = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase();
  if (SUPPORTED_IMAGE_TYPES.has(declaredType)) return declaredType;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return declaredType || EXTENSION_TYPES[extension] || '';
}

export function validateImageFile(file: File): string {
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new AppError('写真の容量が大きすぎます。12MB以下の画像を選択してください。');
  }
  const mimeType = resolveImageMimeType(file);
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    throw new AppError('JPEG、PNG、WebPの画像を選択してください。');
  }
  return mimeType;
}

export async function prepareMediaImage(
  file: File,
  processor: MediaImageProcessor = browserMediaImageProcessor,
): Promise<PreparedMediaImage> {
  const mimeType = validateImageFile(file);
  let decoded: DecodedMediaImage;
  try {
    decoded = await processor.decode(file);
  } catch (error) {
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      throw new AppError('この画像形式は、この端末では読み込めません。JPEGまたはPNGとして書き出してから選択してください。', error);
    }
    throw new AppError('この画像を読み込めませんでした。別の写真を選択してください。', error);
  }
  if (!decoded.width || !decoded.height) {
    throw new AppError('この画像を読み込めませんでした。別の写真を選択してください。');
  }
  try {
    const thumbnailBlob = await processor.createThumbnail(decoded, mimeType);
    if (!thumbnailBlob.size) throw new Error('Empty thumbnail');
    return { file, mimeType, width: decoded.width, height: decoded.height, thumbnailBlob };
  } catch (error) {
    throw new AppError('写真のプレビューを作成できませんでした。別の写真を選択してください。', error);
  }
}

const browserMediaImageProcessor: MediaImageProcessor = {
  async decode(file) {
    if (typeof Image === 'undefined' || typeof URL === 'undefined') throw new Error('Image decoding is unavailable');
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Image decode failed'));
        image.src = objectUrl;
      });
      return { source: image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },
  async createThumbnail(image, mimeType) {
    if (typeof document === 'undefined') throw new Error('Canvas is unavailable');
    const scale = Math.min(1, 960 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context is unavailable');
    context.drawImage(image.source, 0, 0, width, height);
    const outputType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.82));
    if (!blob) throw new Error('Thumbnail generation failed');
    return blob;
  },
};
