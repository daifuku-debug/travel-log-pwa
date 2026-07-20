import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import type { ScrapbookCoverLayout, ScrapbookPage } from '../../../domain/models/scrapbook';
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
import { CoverEditorPanel } from './CoverEditorPanel';
import { PAGE_KIND_LABELS, PageNavigatorSheet } from './PageNavigatorSheet';
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
  const [coverPreviewTemplateId, setCoverPreviewTemplateId] = useState<ScrapbookCoverLayout>();
  const [pendingAction, setPendingAction] = useState<PendingAction>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'previous'>('next');
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const { showToast } = useToast();
  const dirty = !areScrapbookPageDraftsEqual(draft, baseline);
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    document.body.classList.add('scrapbook-editor-active');
    return () => document.body.classList.remove('scrapbook-editor-active');
  }, []);

  if (!selectedPage) return null;

  const previewPage = applyScrapbookPageDraft(selectedPage, draft);
  const previewDraft = selectedPage.pageKind === 'cover' && coverPreviewTemplateId
    ? { ...draft, coverLayout: coverPreviewTemplateId }
    : draft;
  const previewDetail: ScrapbookDetail = {
    ...detail,
    scrapbook: selectedPage.pageKind === 'cover'
      ? applyScrapbookCoverDraft(detail.scrapbook, previewDraft)
      : detail.scrapbook,
    pages: detail.pages.map((page) => page.id === selectedPage.id ? previewPage : page),
  };
  const selectedPageIndex = pages.findIndex((page) => page.id === selectedPage.id);
  const canGoPrevious = selectedPageIndex > 0;
  const canGoNext = selectedPageIndex < pages.length - 1;

  function selectPage(pageId: string) {
    const page = pages.find((item) => item.id === pageId);
    if (!page) return;
    const nextIndex = pages.findIndex((item) => item.id === pageId);
    setPageTurnDirection(nextIndex < selectedPageIndex ? 'previous' : 'next');
    const nextDraft = createScrapbookPageDraft(page, detail.scrapbook);
    setSelectedPageId(page.id);
    onSelectedPageChange(page.id);
    setDraft(nextDraft);
    setBaseline(nextDraft);
    setCoverPreviewTemplateId(undefined);
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

  function requestAdjacentPage(direction: 'previous' | 'next') {
    const offset = direction === 'previous' ? -1 : 1;
    const page = pages[selectedPageIndex + offset];
    if (page) requestPageSelection(page.id);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.isPrimary) pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    const start = pointerStart.current;
    pointerStart.current = undefined;
    if (!start || !event.isPrimary) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
    requestAdjacentPage(deltaX < 0 ? 'next' : 'previous');
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
      const coverSettingsChanged = selectedPage.pageKind === 'cover'
        && (
          draft.coverPhotoId !== baseline.coverPhotoId
          || draft.coverShowDate !== baseline.coverShowDate
          || draft.coverShowLocation !== baseline.coverShowLocation
          || draft.coverShowSubtitle !== baseline.coverShowSubtitle
          || draft.coverTitlePosition !== baseline.coverTitlePosition
        );
      const coverChanged = selectedPage.pageKind === 'cover'
        && (
          coverTitle !== baseline.coverTitle
          || draft.coverSubtitle !== baseline.coverSubtitle
          || coverSettingsChanged
          || draft.coverLayout !== baseline.coverLayout
          || draft.coverThemeId !== baseline.coverThemeId
        );

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
          themeId: draft.coverThemeId,
          status: detail.scrapbook.status,
          isFavorite: detail.scrapbook.isFavorite,
          coverSettings: coverSettingsChanged ? {
            ...detail.scrapbook.coverSettings,
            photoId: draft.coverPhotoId,
            showDate: draft.coverShowDate,
            showLocation: draft.coverShowLocation,
            showSubtitle: draft.coverShowSubtitle,
            titlePosition: draft.coverTitlePosition,
          } : undefined,
          coverLayout: draft.coverLayout !== baseline.coverLayout ? draft.coverLayout : undefined,
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
      setCoverPreviewTemplateId(undefined);
      showToast({ title: '旅行記を更新しました。', variant: 'success' });
      onSaved();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '旅行記を更新できませんでした。';
      setSaveError(message);
      showToast({ title: '更新に失敗しました。入力内容は残っています。', variant: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function discardDraft(notify = true) {
    setDraft(baseline);
    setCoverPreviewTemplateId(undefined);
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

  function closeEditorPanel() {
    setCoverPreviewTemplateId(undefined);
    setEditorOpen(false);
  }

  function applyCoverTemplate() {
    if (!coverPreviewTemplateId) return;
    setDraft((current) => ({ ...current, coverLayout: coverPreviewTemplateId }));
    setCoverPreviewTemplateId(undefined);
  }

  return (
    <div className="scrapbook-editor-mode">
      <header className="scrapbook-editor-toolbar">
        <div className="scrapbook-editor-toolbar__exit">
          <Button variant="ghost" size="sm" onClick={requestExit}>編集を終了</Button>
        </div>
        <div className="scrapbook-editor-toolbar__identity" aria-live="polite">
          <strong title={tripDetail.trip.title}>{tripDetail.trip.title}</strong>
          <span title={draft.pageTitle}>{draft.pageTitle || '名称未設定'}</span>
        </div>
        <div className="scrapbook-editor-toolbar__actions">
          <Button variant="ghost" size="sm" onClick={() => setNavigatorOpen(true)}>ページ</Button>
          <Button variant="ghost" size="sm" onClick={() => setEditorOpen(true)}>
            {selectedPage.pageKind === 'cover' ? '表紙を編集' : '設定'}
          </Button>
        </div>
      </header>

      {saveError && <div className="scrapbook-editor-mode__error"><InlineError message={saveError} /></div>}

      <main
        className="scrapbook-editor-preview"
        aria-label={`${draft.pageTitle || '選択中ページ'}のプレビュー`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerStart.current = undefined; }}
      >
        <div className="scrapbook-editor-preview__label">
          <span>編集中</span>
          <strong>{draft.isHidden && selectedPage.pageKind !== 'cover' ? '非表示ページを確認中' : `${PAGE_KIND_LABELS[selectedPage.pageKind]}の完成イメージ`}</strong>
        </div>
        <div key={selectedPage.id} className={`scrapbook-editor-preview__canvas is-turning-${pageTurnDirection}`}>
          <ScrapbookPagePreview detail={previewDetail} page={previewPage} tripDetail={tripDetail} />
        </div>
        <nav className="scrapbook-editor-pager" aria-label="スクラップブックのページ移動">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canGoPrevious}
            aria-label="前のページへ"
            onClick={() => requestAdjacentPage('previous')}
          >
            <span aria-hidden="true">‹</span>
          </Button>
          <div className="scrapbook-editor-pager__position">
            <strong>{draft.pageTitle || '名称未設定'}</strong>
            <span aria-hidden="true">
              {pages.map((page) => <i key={page.id} className={page.id === selectedPage.id ? 'is-current' : ''} />)}
            </span>
            <small>{selectedPageIndex + 1} / {pages.length}</small>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canGoNext}
            aria-label="次のページへ"
            onClick={() => requestAdjacentPage('next')}
          >
            <span aria-hidden="true">›</span>
          </Button>
        </nav>
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
        onClose={closeEditorPanel}
        title={selectedPage.pageKind === 'cover' ? '表紙を編集' : 'ページを編集'}
        description="変更はプレビューへすぐ反映され、「記録を更新」を選ぶまで完成版には反映されません。"
        size="md"
        actions={<Button variant="primary" disabled={!dirty} loading={saving} onClick={() => void saveDraft()}>記録を更新</Button>}
      >
        {selectedPage.pageKind === 'cover' ? (
          <CoverEditorPanel
            draft={draft}
            mediaAssets={detail.mediaAssets}
            tripDetail={tripDetail}
            previewTemplateId={coverPreviewTemplateId}
            onPreviewTemplate={setCoverPreviewTemplateId}
            onApplyTemplate={applyCoverTemplate}
            onChange={setDraft}
          />
        ) : (
          <PageEditorPanel page={selectedPage} draft={draft} onChange={setDraft} />
        )}
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title="編集内容を記録しますか？"
        description="このページには未記録の編集内容があります。記録を更新して続けるか、変更を破棄してください。"
        confirmLabel="記録を更新"
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
