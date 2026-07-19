import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { ScrapbookPage } from '../../../domain/models/scrapbook';
import { BottomSheet, Button, ConfirmDialog, InlineError, useToast } from '../../../shared/ui';
import type { TripDetail } from '../../trips/tripService';
import {
  areScrapbookPageDraftsEqual,
  applyScrapbookCoverDraft,
  applyScrapbookPageDraft,
  createScrapbookPageDraft,
  type ScrapbookPageDraft,
} from '../scrapbookEditorDraft';
import {
  updateScrapbook,
  updateScrapbookPage,
  type ScrapbookDetail,
} from '../scrapbookService';
import { PageEditorPanel } from './PageEditorPanel';
import { PageNavigatorSheet } from './PageNavigatorSheet';
import { SaveBar } from './SaveBar';
import { ScrapbookPagePreview } from './ScrapbookViewer';

type PendingAction = { type: 'exit' } | { type: 'select'; pageId: string };

export function ScrapbookEditor({
  detail,
  tripDetail,
  initialPageId,
  onExit,
  onSelectedPageChange,
  onSaved,
}: {
  detail: ScrapbookDetail;
  tripDetail: TripDetail;
  initialPageId?: string;
  onExit: () => void;
  onSelectedPageChange: (pageId: string) => void;
  onSaved: () => void;
}) {
  const pages = useMemo(
    () => [...detail.pages].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)),
    [detail.pages],
  );
  const initialPage = (
    pages.find((page) => page.id === initialPageId)
    ?? pages.find((page) => page.pageKind === 'cover')
    ?? pages[0]
  )!;
  const [selectedPageId, setSelectedPageId] = useState(initialPage?.id ?? '');
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? initialPage;
  const [draft, setDraft] = useState<ScrapbookPageDraft>(() => createScrapbookPageDraft(initialPage, detail.scrapbook));
  const [baseline, setBaseline] = useState(draft);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { showToast } = useToast();
  const dirty = !areScrapbookPageDraftsEqual(draft, baseline);
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  if (!selectedPage) return null;

  const previewPage = applyScrapbookPageDraft(selectedPage, draft);
  const previewDetail: ScrapbookDetail = {
    ...detail,
    scrapbook: selectedPage.pageKind === 'cover'
      ? applyScrapbookCoverDraft(detail.scrapbook, draft)
      : detail.scrapbook,
    pages: detail.pages.map((page) => page.id === selectedPage.id ? previewPage : page),
  };

  function selectPage(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    const nextDraft = createScrapbookPageDraft(page, detail.scrapbook);
    setSelectedPageId(page.id);
    onSelectedPageChange(page.id);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setSaveError('');
    setNavigatorOpen(false);
  }

  function requestPageSelection(pageId: string) {
    if (pageId === selectedPage.id) {
      setNavigatorOpen(false);
      return;
    }
    if (dirty) {
      setPendingAction({ type: 'select', pageId });
      return;
    }
    selectPage(pageId);
  }

  function requestExit() {
    if (dirty) {
      setPendingAction({ type: 'exit' });
      return;
    }
    onExit();
  }

  async function saveDraft(): Promise<boolean> {
    const pageTitle = draft.pageTitle.trim();
    const coverTitle = draft.coverTitle.trim();
    if (!pageTitle || (selectedPage.pageKind === 'cover' && !coverTitle)) {
      setSaveError('タイトルを入力してください。');
      return false;
    }

    setSaving(true);
    setSaveError('');
    try {
      const pageChanged = pageTitle !== baseline.pageTitle || draft.isHidden !== baseline.isHidden;
      const coverChanged = selectedPage.pageKind === 'cover'
        && (coverTitle !== baseline.coverTitle || draft.coverSubtitle !== baseline.coverSubtitle);

      if (pageChanged) {
        await updateScrapbookPage(selectedPage.id, {
          title: pageTitle,
          date: selectedPage.date ?? '',
          dayNumber: selectedPage.dayNumber ?? 0,
          layoutType: selectedPage.layoutType,
          backgroundStyle: selectedPage.backgroundStyle ?? '',
          isHidden: selectedPage.pageKind === 'cover' ? false : draft.isHidden,
        });
      }
      if (coverChanged) {
        await updateScrapbook(detail.scrapbook.id, {
          title: coverTitle,
          subtitle: draft.coverSubtitle,
          themeId: detail.scrapbook.themeId,
          status: detail.scrapbook.status,
          isFavorite: detail.scrapbook.isFavorite,
        });
      }

      const savedDraft = {
        ...draft,
        pageTitle,
        coverTitle,
        isHidden: selectedPage.pageKind === 'cover' ? false : draft.isHidden,
      };
      setDraft(savedDraft);
      setBaseline(savedDraft);
      showToast({ title: 'ページを保存しました。', variant: 'success' });
      onSaved();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ページを保存できませんでした。';
      setSaveError(message);
      showToast({ title: '保存に失敗しました。入力内容は残っています。', variant: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discardDraft(notify = true) {
    setDraft(baseline);
    setSaveError('');
    if (notify) showToast({ title: '変更を破棄しました。', variant: 'info' });
  }

  function completePendingAction() {
    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }
    if (pendingAction?.type === 'exit') onExit();
    if (pendingAction?.type === 'select') selectPage(pendingAction.pageId);
    setPendingAction(undefined);
  }

  async function saveAndContinue() {
    if (await saveDraft()) completePendingAction();
  }

  function discardAndContinue() {
    discardDraft();
    completePendingAction();
  }

  function cancelPendingAction() {
    if (blocker.state === 'blocked') blocker.reset();
    setPendingAction(undefined);
  }

  const confirmOpen = Boolean(pendingAction) || blocker.state === 'blocked';

  return (
    <div className="scrapbook-editor-mode">
      <header className="scrapbook-editor-toolbar">
        <Button variant="ghost" size="sm" onClick={requestExit}>閲覧に戻る</Button>
        <div>
          <span>編集中</span>
          <strong>{draft.pageTitle || '名称未設定'}</strong>
        </div>
        <div className="scrapbook-editor-toolbar__actions">
          <Button size="sm" onClick={() => setNavigatorOpen(true)}>ページ</Button>
          <Button variant="primary" size="sm" onClick={() => setEditorOpen(true)}>編集</Button>
        </div>
      </header>

      {saveError && <div className="scrapbook-editor-mode__error"><InlineError message={saveError} /></div>}

      <main className="scrapbook-editor-preview" aria-label={`${draft.pageTitle || '選択中ページ'}のプレビュー`}>
        <div className="scrapbook-editor-preview__label">
          <span>{selectedPage.pageKind}</span>
          <strong>{draft.isHidden && selectedPage.pageKind !== 'cover' ? '非表示ページを確認中' : '完成イメージ'}</strong>
        </div>
        <div className="scrapbook-editor-preview__canvas">
          <ScrapbookPagePreview detail={previewDetail} page={previewPage} tripDetail={tripDetail} />
        </div>
      </main>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => discardDraft()}
        onSave={() => void saveDraft()}
      />

      <PageNavigatorSheet
        open={navigatorOpen}
        detail={detail}
        selectedPageId={selectedPage.id}
        selectedPageTitle={draft.pageTitle}
        draftHidden={draft.isHidden}
        onClose={() => setNavigatorOpen(false)}
        onSelect={requestPageSelection}
      />

      <BottomSheet
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="ページを編集"
        description="変更はプレビューへすぐ反映され、保存するまで端末には書き込まれません。"
        size="md"
        actions={<Button variant="primary" disabled={!dirty} loading={saving} onClick={() => void saveDraft()}>保存</Button>}
      >
        <PageEditorPanel page={selectedPage} draft={draft} onChange={setDraft} />
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title="変更を保存しますか？"
        description="このページには未保存の変更があります。保存して続けるか、変更を破棄してください。"
        confirmLabel="保存する"
        secondaryLabel="破棄する"
        cancelLabel="キャンセル"
        variant="primary"
        processing={saving}
        onConfirm={saveAndContinue}
        onSecondary={discardAndContinue}
        onCancel={cancelPendingAction}
      />
    </div>
  );
}
