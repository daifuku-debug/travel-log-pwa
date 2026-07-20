import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntityId } from '../../domain/models/common';
import type { MediaAsset } from '../../domain/models/scrapbook';
import {
  prepareMediaImage,
  savePreparedTripMediaAsset,
  type PreparedMediaImage,
} from '../media/mediaAssetService';

export type CoverPhotoImportStatus = 'validating' | 'previewing' | 'saving' | 'error';

export interface PendingCoverPhoto {
  file: File;
  previewUrl?: string;
  status: CoverPhotoImportStatus;
  width?: number;
  height?: number;
  error?: string;
}

export function useCoverPhotoImport(tripId: EntityId) {
  const [pending, setPending] = useState<PendingCoverPhoto>();
  const preparedRef = useRef<PreparedMediaImage | undefined>(undefined);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const requestIdRef = useRef(0);
  const savingRef = useRef(false);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = undefined;
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    releasePreview();
    preparedRef.current = undefined;
    setPending(undefined);
  }, [releasePreview]);

  const selectFile = useCallback(async (file: File) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    releasePreview();
    preparedRef.current = undefined;
    const previewUrl = URL.createObjectURL(file);
    previewUrlRef.current = previewUrl;
    setPending({ file, previewUrl, status: 'validating' });
    try {
      const prepared = await prepareMediaImage(file);
      if (requestIdRef.current !== requestId) return;
      preparedRef.current = prepared;
      setPending({
        file,
        previewUrl,
        status: 'previewing',
        width: prepared.width,
        height: prepared.height,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      releasePreview();
      setPending({
        file,
        status: 'error',
        error: error instanceof Error ? error.message : '写真を読み込めませんでした。',
      });
    }
  }, [releasePreview]);

  const save = useCallback(async (): Promise<MediaAsset | undefined> => {
    const prepared = preparedRef.current;
    if (!prepared || !pending || savingRef.current) return undefined;
    savingRef.current = true;
    const requestId = requestIdRef.current;
    setPending((current) => current ? { ...current, status: 'saving', error: undefined } : current);
    try {
      const asset = await savePreparedTripMediaAsset(tripId, prepared);
      if (requestIdRef.current !== requestId) {
        savingRef.current = false;
        return asset;
      }
      releasePreview();
      preparedRef.current = undefined;
      setPending(undefined);
      savingRef.current = false;
      return asset;
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setPending((current) => current ? {
          ...current,
          status: 'error',
          error: error instanceof Error ? error.message : '写真を保存できませんでした。',
        } : current);
      }
      savingRef.current = false;
      return undefined;
    }
  }, [pending, releasePreview, tripId]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    releasePreview();
  }, [releasePreview]);

  return {
    pending,
    hasPending: Boolean(pending),
    selectFile,
    save,
    cancel,
  };
}
