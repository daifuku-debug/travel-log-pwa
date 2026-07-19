import type { ScrapbookPageKind } from '../../../domain/models/scrapbook';
import { BottomSheet } from '../../../shared/ui';
import type { ScrapbookDetail } from '../scrapbookService';

const PAGE_KIND_LABELS: Record<ScrapbookPageKind, string> = {
  cover: '表紙',
  story: '物語',
  timeline: '旅の流れ',
  photo: '写真',
  place: '場所',
  feature: '特集',
  ending: '結び',
  custom: '自由ページ',
};

export function PageNavigatorSheet({
  open,
  detail,
  selectedPageId,
  selectedPageTitle,
  draftHidden,
  onClose,
  onSelect,
}: {
  open: boolean;
  detail: ScrapbookDetail;
  selectedPageId: string;
  selectedPageTitle: string;
  draftHidden: boolean;
  onClose: () => void;
  onSelect: (pageId: string) => void;
}) {
  const pages = [...detail.pages].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="ページを選ぶ"
      description="編集するページを選択します。"
      size="lg"
    >
      <div className="scrapbook-page-navigator" role="list">
        {pages.map((page, index) => {
          const selected = page.id === selectedPageId;
          const hidden = selected ? draftHidden : Boolean(page.isHidden);
          return (
            <button
              key={page.id}
              className={`scrapbook-page-navigator__item${selected ? ' is-selected' : ''}`}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => onSelect(page.id)}
            >
              <span className={`scrapbook-page-navigator__thumbnail scrapbook-page-navigator__thumbnail--${page.pageKind}`} aria-hidden="true">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <i /><i /><i />
              </span>
              <span className="scrapbook-page-navigator__copy">
                <strong>{selected ? selectedPageTitle : page.title}</strong>
                <span>{PAGE_KIND_LABELS[page.pageKind]} · {page.origin === 'manual' ? '手動' : '自動生成'}</span>
                <small>{hidden ? '非表示' : '表示中'}</small>
              </span>
              {selected && <span className="scrapbook-page-navigator__current">選択中</span>}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
