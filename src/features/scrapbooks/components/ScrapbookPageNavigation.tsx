import type { ReactNode } from 'react';
import type { ScrapbookBlock, ScrapbookPage } from '../../../domain/models/scrapbook';
import { Button, Card } from '../../../shared/ui';

export function ScrapbookPageNavigation({
  pages,
  selectedPageId,
  editing,
  addPageAction,
  onSelect,
  onMove,
}: {
  pages: Array<ScrapbookPage & { blocks: ScrapbookBlock[] }>;
  selectedPageId?: string;
  editing: boolean;
  addPageAction?: ReactNode;
  onSelect: (pageId: string) => void;
  onMove: (pageId: string, direction: -1 | 1) => void;
}) {
  return (
    <Card className="scrapbook-pages" title="ページ" actions={addPageAction}>
      <div className="scrapbook-page-list">
        {pages.map((page, index) => (
          <div className={selectedPageId === page.id ? 'scrapbook-page-row selected' : 'scrapbook-page-row'} key={page.id}>
            <button className="scrapbook-page-row__select" type="button" onClick={() => onSelect(page.id)} aria-pressed={selectedPageId === page.id}>
              <strong>{page.title}</strong>
              <span>{page.date || page.layoutType} / {page.blocks.length}ブロック</span>
            </button>
            {editing && (
              <div className="scrapbook-page-row__actions" aria-label={`${page.title}の並び順`}>
                <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(page.id, -1)} aria-label={`${page.title}を上へ移動`}>↑</Button>
                <Button size="sm" variant="ghost" disabled={index === pages.length - 1} onClick={() => onMove(page.id, 1)} aria-label={`${page.title}を下へ移動`}>↓</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
