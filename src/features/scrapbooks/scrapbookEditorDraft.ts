import type { Scrapbook, ScrapbookPage } from '../../domain/models/scrapbook';

export interface ScrapbookPageDraft {
  pageId: string;
  pageTitle: string;
  isHidden: boolean;
  coverTitle: string;
  coverSubtitle: string;
}

export function createScrapbookPageDraft(
  page: ScrapbookPage,
  scrapbook: Scrapbook,
): ScrapbookPageDraft {
  return {
    pageId: page.id,
    pageTitle: page.title,
    isHidden: page.isHidden ?? false,
    coverTitle: scrapbook.title,
    coverSubtitle: scrapbook.subtitle ?? '',
  };
}

export function isScrapbookPageDraftDirty(
  draft: ScrapbookPageDraft,
  page: ScrapbookPage,
  scrapbook: Scrapbook,
): boolean {
  return draft.pageTitle !== page.title
    || draft.isHidden !== (page.isHidden ?? false)
    || (page.pageKind === 'cover' && (
      draft.coverTitle !== scrapbook.title
      || draft.coverSubtitle !== (scrapbook.subtitle ?? '')
    ));
}

export function areScrapbookPageDraftsEqual(
  left: ScrapbookPageDraft,
  right: ScrapbookPageDraft,
): boolean {
  return left.pageId === right.pageId
    && left.pageTitle === right.pageTitle
    && left.isHidden === right.isHidden
    && left.coverTitle === right.coverTitle
    && left.coverSubtitle === right.coverSubtitle;
}

export function applyScrapbookPageDraft<T extends ScrapbookPage>(
  page: T,
  draft: ScrapbookPageDraft,
): T {
  return {
    ...page,
    title: draft.pageTitle,
    isHidden: false,
  };
}

export function applyScrapbookCoverDraft(
  scrapbook: Scrapbook,
  draft: ScrapbookPageDraft,
): Scrapbook {
  return {
    ...scrapbook,
    title: draft.coverTitle,
    subtitle: draft.coverSubtitle || undefined,
  };
}
