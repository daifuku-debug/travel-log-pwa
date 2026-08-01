import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntityId } from '../../domain/models/common';
import type { MediaAsset, MediaAssetUsage } from '../../domain/models/scrapbook';
import {
  prepareMediaImage,
  savePreparedTripMediaAsset,
  type PreparedMediaImage,
} from '../media/mediaAssetService';
import { findExactDuplicateMediaAssets } from '../media/mediaAssetDuplicateService';

export type CoverPhotoImportStatus = 'validating' | 'checking-duplicates' | 'previewing' | 'saving' | 'error';
export type DuplicateReviewStatus = 'not-checked' | 'none' | 'found' | 'bypassed' | 'error';

export interface PendingCoverPhoto {
  file: File;
  destination: MediaAssetUsage;
  previewUrl?: string;
  status: CoverPhotoImportStatus;
  contentHash?: string;
  duplicateMatches: MediaAsset[];
  duplicateReviewStatus: DuplicateReviewStatus;
  selectedDuplicateAssetId?: EntityId;
  width?: number;
  height?: number;
  error?: string;
}

export function useCoverPhotoImport(tripId: EntityId, scrapbookId?: EntityId) {
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
    setPending({
      file,
      previewUrl,
      status: 'validating',
      destination: 'trip',
      duplicateMatches: [],
      duplicateReviewStatus: 'not-checked',
    });
    try {
      const prepared = await prepareMediaImage(file);
      if (requestIdRef.current !== requestId) return;
      preparedRef.current = prepared;
      setPending({
        file,
        previewUrl,
        status: 'checking-duplicates',
        destination: 'trip',
        contentHash: prepared.contentHash,
        duplicateMatches: [],
        duplicateReviewStatus: 'not-checked',
        width: prepared.width,
        height: prepared.height,
      });
      await checkForDuplicates(prepared, file, previewUrl, 'trip', requestId);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      releasePreview();
      setPending({
        file,
        status: 'error',
        destination: 'trip',
        duplicateMatches: [],
        duplicateReviewStatus: 'not-checked',
        error: error instanceof Error ? error.message : '写真を読み込めませんでした。',
      });
    }
  }, [releasePreview, scrapbookId, tripId]);

  const retryDuplicateCheck = useCallback(async () => {
    const prepared = preparedRef.current;
    const current = pending;
    if (!prepared || !current?.previewUrl || savingRef.current) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPending({
      ...current,
      status: 'checking-duplicates',
      duplicateMatches: [],
      duplicateReviewStatus: 'not-checked',
      selectedDuplicateAssetId: undefined,
      error: undefined,
    });
    await checkForDuplicates(prepared, current.file, current.previewUrl, current.destination, requestId);
  }, [pending, scrapbookId, tripId]);

  async function checkForDuplicates(
    prepared: PreparedMediaImage,
    file: File,
    previewUrl: string,
    destination: MediaAssetUsage,
    requestId: number,
  ) {
    if (!prepared.contentHash) throw new Error('写真の識別情報を確認できませんでした。');
    try {
      const matches = await findExactDuplicateMediaAssets({
        tripId,
        scrapbookId,
        contentHash: prepared.contentHash,
        fileInfo: {
          fileSize: file.size,
          mimeType: prepared.mimeType,
          width: prepared.width,
          height: prepared.height,
        },
      });
      if (requestIdRef.current !== requestId) return;
      setPending({
        file,
        previewUrl,
        status: 'previewing',
        destination,
        contentHash: prepared.contentHash,
        duplicateMatches: matches.map((match) => match.asset),
        duplicateReviewStatus: matches.length > 0 ? 'found' : 'none',
        selectedDuplicateAssetId: matches[0]?.asset.id,
        width: prepared.width,
        height: prepared.height,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setPending({
        file,
        previewUrl,
        status: 'previewing',
        destination,
        contentHash: prepared.contentHash,
        duplicateMatches: [],
        duplicateReviewStatus: 'error',
        width: prepared.width,
        height: prepared.height,
        error: '同じ写真があるか確認できませんでした。確認せずに新しく追加できます。',
      });
    }
  }

  const setDestination = useCallback((destination: MediaAssetUsage) => {
    setPending((current) => current ? { ...current, destination } : current);
  }, []);

  const selectDuplicate = useCallback((assetId: EntityId) => {
    setPending((current) => current?.duplicateMatches.some((asset) => asset.id === assetId)
      ? { ...current, selectedDuplicateAssetId: assetId }
      : current);
  }, []);

  const bypassDuplicateReview = useCallback(() => {
    setPending((current) => current ? {
      ...current,
      status: 'previewing',
      duplicateReviewStatus: 'bypassed',
      error: undefined,
    } : current);
  }, []);

  const reuseDuplicate = useCallback((): MediaAsset | undefined => {
    const asset = pending?.duplicateMatches.find((item) => item.id === pending.selectedDuplicateAssetId);
    if (!asset) return undefined;
    requestIdRef.current += 1;
    releasePreview();
    preparedRef.current = undefined;
    setPending(undefined);
    return asset;
  }, [pending, releasePreview]);

  const save = useCallback(async (): Promise<MediaAsset | undefined> => {
    const prepared = preparedRef.current;
    if (!prepared || !pending || savingRef.current) return undefined;
    if (!['none', 'bypassed'].includes(pending.duplicateReviewStatus)) return undefined;
    savingRef.current = true;
    const requestId = requestIdRef.current;
    setPending((current) => current ? { ...current, status: 'saving', error: undefined } : current);
    try {
      if (pending.destination === 'cover-only' && !scrapbookId) {
        throw new Error('表紙専用写真の保存先を確認できませんでした。');
      }
      const asset = await savePreparedTripMediaAsset(tripId, prepared, pending.destination === 'cover-only'
        ? { usage: 'cover-only', ownerScrapbookId: scrapbookId }
        : { usage: 'trip' });
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
  }, [pending, releasePreview, scrapbookId, tripId]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    releasePreview();
  }, [releasePreview]);

  return {
    pending,
    hasPending: Boolean(pending),
    selectFile,
    setDestination,
    selectDuplicate,
    bypassDuplicateReview,
    retryDuplicateCheck,
    reuseDuplicate,
    save,
    cancel,
  };
}
