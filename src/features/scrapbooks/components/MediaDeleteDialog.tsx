import { useEffect, useMemo, useState } from 'react';
import {
  groupMediaAssetReferences,
  type MediaAssetReferenceGroup,
} from '../../../domain/media/mediaAssetReferenceDetachment';
import type { MediaAssetReference } from '../../../domain/media/mediaAssetReferences';
import { isCoverOnlyMediaAsset } from '../../../domain/media/mediaAssetUsage';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import {
  deleteUnreferencedMediaAsset,
  MediaAssetDeletionError,
  type DeleteUnreferencedMediaAssetResult,
} from '../../media/mediaAssetDeletionService';
import {
  detachMediaAssetReferences,
  type DetachMediaAssetReferencesResult,
} from '../../media/mediaAssetReferenceDetachmentService';
import { findMediaAssetReferences } from '../../media/mediaAssetReferenceService';
import { BottomSheet, Button, InlineError } from '../../../shared/ui';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

type DeleteDialogStatus = 'checking' | 'ready' | 'detaching' | 'deleting' | 'error';

interface DeleteDialogState {
  status: DeleteDialogStatus;
  references: MediaAssetReference[];
  referenceCheckComplete: boolean;
  error: string;
}

const INITIAL_STATE: DeleteDialogState = {
  status: 'checking',
  references: [],
  referenceCheckComplete: false,
  error: '',
};

export function MediaDeleteDialog({
  asset,
  protectedByDraft,
  onClose,
  onDeleted,
  onReferencesDetached,
}: {
  asset?: MediaAsset;
  protectedByDraft: boolean;
  onClose: () => void;
  onDeleted: (result: DeleteUnreferencedMediaAssetResult) => void;
  onReferencesDetached: (result: DetachMediaAssetReferencesResult) => void;
}) {
  const [state, setState] = useState<DeleteDialogState>(INITIAL_STATE);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const referenceGroups = useMemo(() => groupMediaAssetReferences(state.references), [state.references]);
  const busy = state.status === 'checking' || state.status === 'detaching' || state.status === 'deleting';

  useEffect(() => {
    if (!asset) return undefined;
    let active = true;
    setState(INITIAL_STATE);
    setSelectedGroupKeys(new Set());
    loadReferences(asset)
      .then((references) => {
        if (active) setState({ status: 'ready', references, referenceCheckComplete: true, error: '' });
      })
      .catch(() => {
        if (active) setState({
          status: 'error',
          references: [],
          referenceCheckComplete: false,
          error: '写真の使用状況を確認できませんでした。安全のため変更・削除できません。',
        });
      });
    return () => { active = false; };
  }, [asset]);

  if (!asset) return null;

  const canDelete = state.referenceCheckComplete
    && state.references.length === 0
    && !protectedByDraft
    && state.status !== 'detaching';
  const selectedDetachableCount = referenceGroups.filter((group) => (
    group.detachable && selectedGroupKeys.has(group.key)
  )).length;

  async function refreshReferences(error = ''): Promise<MediaAssetReference[] | undefined> {
    try {
      const references = await loadReferences(asset!);
      setState({
        status: error ? 'error' : 'ready',
        references,
        referenceCheckComplete: true,
        error,
      });
      setSelectedGroupKeys((current) => new Set(
        [...current].filter((key) => groupMediaAssetReferences(references).some((group) => group.key === key && group.detachable)),
      ));
      return references;
    } catch {
      setState({
        status: 'error',
        references: [],
        referenceCheckComplete: false,
        error: error || '写真の使用状況を確認できませんでした。安全のため変更・削除できません。',
      });
      setSelectedGroupKeys(new Set());
      return undefined;
    }
  }

  async function handleDetach() {
    if (selectedDetachableCount === 0 || protectedByDraft) return;
    setState((current) => ({ ...current, status: 'detaching', error: '' }));
    try {
      const result = await detachMediaAssetReferences({
        assetId: asset!.id,
        tripId: asset!.tripId,
        selectedGroupKeys: [...selectedGroupKeys],
        protectedAssetIds: protectedByDraft ? [asset!.id] : [],
      });
      setSelectedGroupKeys(new Set());
      setState({
        status: 'ready',
        references: result.remainingReferences,
        referenceCheckComplete: true,
        error: '',
      });
      onReferencesDetached(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : '参照を解除できませんでした。写真は削除していません。';
      await refreshReferences(message);
    }
  }

  async function handleDelete() {
    setState((current) => ({ ...current, status: 'deleting', error: '' }));
    try {
      const result = await deleteUnreferencedMediaAsset({
        assetId: asset!.id,
        protectedAssetIds: protectedByDraft ? [asset!.id] : [],
      });
      onDeleted(result);
    } catch (error) {
      if (error instanceof MediaAssetDeletionError && error.code === 'referenced') {
        setSelectedGroupKeys(new Set());
        setState({ status: 'ready', references: error.references, referenceCheckComplete: true, error: '' });
        return;
      }
      setState((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : '写真を削除できませんでした。',
      }));
    }
  }

  function toggleGroup(group: MediaAssetReferenceGroup) {
    if (!group.detachable || busy || protectedByDraft) return;
    setSelectedGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(group.key)) next.delete(group.key);
      else next.add(group.key);
      return next;
    });
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="写真を削除"
      description="使用中の参照を確認し、安全に解除できるものだけを選んでください。"
      size="sm"
      dismissible={!busy}
    >
      <div className="scrapbook-media-delete" aria-busy={busy || undefined}>
        <div className="scrapbook-media-delete__preview">
          <ScrapbookMediaImage asset={asset} alt={`${asset.originalFileName || '写真'}の削除確認`} />
          <span>{isCoverOnlyMediaAsset(asset) ? '表紙専用' : '旅行写真'}</span>
        </div>
        <div className="scrapbook-media-delete__copy" aria-live="polite">
          <strong>{asset.originalFileName || '保存した写真'}</strong>
          {state.status === 'checking' && <p role="status">使用状況を確認しています…</p>}
          {protectedByDraft && <p className="is-blocked">編集中の表紙で選択しているため、参照解除と削除はできません。</p>}
          {state.referenceCheckComplete && state.references.length === 0 && !protectedByDraft && (
            <p>この写真は現在使用されていません。端末から完全に削除できます。</p>
          )}
          {state.error && <InlineError message={state.error} />}
        </div>

        {state.referenceCheckComplete && referenceGroups.length > 0 && (
          <fieldset className="scrapbook-media-references" disabled={busy || protectedByDraft}>
            <legend>使用中の参照</legend>
            <p>解除する項目だけを選択してください。初期状態では選択されていません。</p>
            <div className="scrapbook-media-references__list">
              {referenceGroups.map((group) => (
                <label key={group.key} className={`${group.detachable ? 'is-detachable' : 'is-required'}${selectedGroupKeys.has(group.key) ? ' is-selected' : ''}`}>
                  {group.detachable ? (
                    <input
                      type="checkbox"
                      checked={selectedGroupKeys.has(group.key)}
                      onChange={() => toggleGroup(group)}
                    />
                  ) : <span className="scrapbook-media-references__lock" aria-hidden="true">!</span>}
                  <span className="scrapbook-media-references__content">
                    <strong>{referenceGroupTitle(group)}</strong>
                    <small>{referenceGroupLocation(group)}</small>
                    <small>参照箇所: {group.fields.join(' / ')}{group.occurrenceCount > 1 ? ` (${group.occurrenceCount}件)` : ''}</small>
                  </span>
                  <span className="scrapbook-media-references__status">
                    {group.detachable ? '解除可能' : '先に編集が必要'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="scrapbook-media-delete__actions">
          {referenceGroups.length > 0 && (
            <Button
              variant="primary"
              loading={state.status === 'detaching'}
              disabled={selectedDetachableCount === 0 || protectedByDraft}
              onClick={() => void handleDetach()}
            >
              選択した参照を解除
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" loading={state.status === 'deleting'} onClick={() => void handleDelete()}>
              写真を削除
            </Button>
          )}
          {!state.referenceCheckComplete && state.status === 'error' && (
            <Button onClick={() => void refreshReferences()}>使用状況を再確認</Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={onClose}>キャンセル</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

function loadReferences(asset: MediaAsset): Promise<MediaAssetReference[]> {
  return findMediaAssetReferences({ assetId: asset.id, tripId: asset.tripId });
}

function referenceGroupTitle(group: MediaAssetReferenceGroup): string {
  switch (group.kind) {
    case 'cover': return '表紙';
    case 'highlight': return 'ハイライト写真';
    case 'photo': return '写真ページ';
    case 'photo-grid': return '写真グリッド';
    case 'meal': return '食事の記録';
    case 'ticket': return 'チケット・記念品';
    case 'purchase': return '買ったもの';
  }
}

function referenceGroupLocation(group: MediaAssetReferenceGroup): string {
  const parts = [group.ownerLabel, group.pageLabel, group.blockLabel].filter(Boolean);
  if (parts.length > 0) return parts.join(' / ');
  return group.kind === 'cover' || group.kind === 'highlight' ? 'スクラップブック全体' : 'ページ内の記録';
}
