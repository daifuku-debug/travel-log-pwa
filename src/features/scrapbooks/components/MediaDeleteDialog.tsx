import { useEffect, useState } from 'react';
import type { MediaAssetReference } from '../../../domain/media/mediaAssetReferences';
import { isCoverOnlyMediaAsset } from '../../../domain/media/mediaAssetUsage';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import {
  deleteUnreferencedMediaAsset,
  MediaAssetDeletionError,
  type DeleteUnreferencedMediaAssetResult,
} from '../../media/mediaAssetDeletionService';
import { findMediaAssetReferences } from '../../media/mediaAssetReferenceService';
import { BottomSheet, Button, InlineError } from '../../../shared/ui';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

type DeleteCheckState =
  | { status: 'checking'; references: MediaAssetReference[]; error: '' }
  | { status: 'ready'; references: MediaAssetReference[]; error: '' }
  | { status: 'deleting'; references: MediaAssetReference[]; error: '' }
  | { status: 'error'; references: MediaAssetReference[]; error: string };

const INITIAL_STATE: DeleteCheckState = { status: 'checking', references: [], error: '' };

export function MediaDeleteDialog({
  asset,
  protectedByDraft,
  onClose,
  onDeleted,
}: {
  asset?: MediaAsset;
  protectedByDraft: boolean;
  onClose: () => void;
  onDeleted: (result: DeleteUnreferencedMediaAssetResult) => void;
}) {
  const [state, setState] = useState<DeleteCheckState>(INITIAL_STATE);

  useEffect(() => {
    if (!asset) return undefined;
    let active = true;
    setState(INITIAL_STATE);
    findMediaAssetReferences({ assetId: asset.id, tripId: asset.tripId })
      .then((references) => {
        if (active) setState({ status: 'ready', references, error: '' });
      })
      .catch(() => {
        if (active) setState({
          status: 'error',
          references: [],
          error: '写真の使用状況を確認できませんでした。安全のため削除できません。',
        });
      });
    return () => { active = false; };
  }, [asset]);

  if (!asset) return null;

  const blockedByReference = state.references.length > 0;
  const canDelete = state.status === 'ready' && !blockedByReference && !protectedByDraft;
  const showDeleteAction = (state.status === 'ready' || state.status === 'deleting')
    && !blockedByReference
    && !protectedByDraft;

  async function handleDelete() {
    setState((current) => ({ status: 'deleting', references: current.references, error: '' }));
    try {
      const result = await deleteUnreferencedMediaAsset({
        assetId: asset!.id,
        protectedAssetIds: protectedByDraft ? [asset!.id] : [],
      });
      onDeleted(result);
    } catch (error) {
      if (error instanceof MediaAssetDeletionError && error.code === 'referenced') {
        setState({ status: 'ready', references: error.references, error: '' });
        return;
      }
      setState((current) => ({
        status: 'error',
        references: current.references,
        error: error instanceof Error ? error.message : '写真を削除できませんでした。',
      }));
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="写真を削除"
      description="この写真が表紙や本文で使われていないことを確認してから削除します。"
      size="sm"
      dismissible={state.status !== 'deleting'}
    >
      <div className="scrapbook-media-delete" aria-busy={state.status === 'checking' || state.status === 'deleting' || undefined}>
        <div className="scrapbook-media-delete__preview">
          <ScrapbookMediaImage asset={asset} alt={`${asset.originalFileName || '写真'}の削除確認`} />
          <span>{isCoverOnlyMediaAsset(asset) ? '表紙専用' : '旅行写真'}</span>
        </div>
        <div className="scrapbook-media-delete__copy" aria-live="polite">
          <strong>{asset.originalFileName || '保存した写真'}</strong>
          {state.status === 'checking' && <p role="status">使用状況を確認しています…</p>}
          {blockedByReference && <p className="is-blocked">表紙や本文で使用中のため削除できません。</p>}
          {protectedByDraft && !blockedByReference && <p className="is-blocked">編集中の表紙で選択しているため削除できません。</p>}
          {canDelete && <p>この写真は現在使用されていません。端末から完全に削除できます。</p>}
          {state.error && <InlineError message={state.error} />}
        </div>
        <div className="scrapbook-media-delete__actions">
          {showDeleteAction && (
            <Button variant="danger" loading={state.status === 'deleting'} onClick={() => void handleDelete()}>
              写真を削除
            </Button>
          )}
          {state.status === 'error' && !blockedByReference && !protectedByDraft && (
            <Button onClick={() => void handleDelete()}>もう一度試す</Button>
          )}
          <Button variant="ghost" disabled={state.status === 'deleting'} onClick={onClose}>キャンセル</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
