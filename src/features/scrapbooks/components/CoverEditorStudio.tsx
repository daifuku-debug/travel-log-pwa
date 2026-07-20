import type { ReactNode } from 'react';
import type { TripDetail } from '../../trips/tripService';
import type { ScrapbookDetail } from '../scrapbookService';
import { ScrapbookPagePreview } from './ScrapbookViewer';

export function CoverEditorStudio({
  previewDetail,
  previewPage,
  tripDetail,
  previewKey,
  children,
}: {
  previewDetail: ScrapbookDetail;
  previewPage: ScrapbookDetail['pages'][number];
  tripDetail: TripDetail;
  previewKey: string;
  children: ReactNode;
}) {
  return (
    <div className="scrapbook-cover-studio">
      <section className="scrapbook-cover-studio__stage" aria-labelledby="cover-studio-preview-heading">
        <header>
          <span>Live preview</span>
          <h3 id="cover-studio-preview-heading">完成プレビュー</h3>
        </header>
        <div className="scrapbook-cover-studio__canvas" aria-live="polite">
          <div key={previewKey} className="scrapbook-cover-studio__canvas-inner">
            <ScrapbookPagePreview detail={previewDetail} page={previewPage} tripDetail={tripDetail} />
          </div>
        </div>
        <p>編集内容は保存前でも、この表紙に反映されます。</p>
      </section>
      <section className="scrapbook-cover-studio__controls" aria-label="表紙の編集項目">
        {children}
      </section>
    </div>
  );
}
