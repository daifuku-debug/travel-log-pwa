import type { CSSProperties } from 'react';
import type { EntityId } from '../../../domain/models/common';
import type { MediaAsset, ScrapbookCoverLayout, ScrapbookThemeId } from '../../../domain/models/scrapbook';
import { formatCompactDateRange } from '../../../shared/date/dateUtils';
import { Button } from '../../../shared/ui';
import { COVER_TEMPLATES, COVER_THEMES } from '../coverDesignRegistry';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

export function CoverDesignPanel({
  appliedTemplateId,
  previewTemplateId,
  themeId,
  title,
  subtitle,
  startDate,
  endDate,
  selectedPhotoId,
  mediaAssets,
  onPreviewTemplate,
  onApplyTemplate,
  onThemeChange,
}: {
  appliedTemplateId: ScrapbookCoverLayout;
  previewTemplateId?: ScrapbookCoverLayout;
  themeId: ScrapbookThemeId;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  selectedPhotoId?: EntityId;
  mediaAssets: MediaAsset[];
  onPreviewTemplate: (templateId: ScrapbookCoverLayout) => void;
  onApplyTemplate: () => void;
  onThemeChange: (themeId: ScrapbookThemeId) => void;
}) {
  const candidateId = previewTemplateId ?? appliedTemplateId;
  const candidate = COVER_TEMPLATES.find((template) => template.id === candidateId) ?? COVER_TEMPLATES[0];
  const selectedAsset = mediaAssets.find((asset) => asset.id === selectedPhotoId);
  const selectedTheme = COVER_THEMES.find((theme) => theme.id === themeId) ?? COVER_THEMES[0];
  const dateLabel = formatCompactDateRange(startDate, endDate);

  return (
    <div className="scrapbook-cover-design">
      <section className="scrapbook-cover-panel" aria-labelledby="cover-template-heading">
        <header className="scrapbook-cover-panel__heading">
          <span>Composition</span>
          <h3 id="cover-template-heading">表紙テンプレート</h3>
          <p>候補を選ぶと、閉じる前に大きな表紙で比較できます。</p>
        </header>
        <div className="scrapbook-cover-template-grid" role="radiogroup" aria-label="表紙テンプレート候補">
          {COVER_TEMPLATES.map((template) => {
            const previewing = candidateId === template.id;
            const applied = appliedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                className={`scrapbook-cover-template${previewing ? ' is-previewing' : ''}${applied ? ' is-applied' : ''}`}
                role="radio"
                aria-checked={previewing}
                onClick={() => onPreviewTemplate(template.id)}
              >
                <span
                  className={`scrapbook-cover-template__preview scrapbook-cover-template__preview--${template.previewVariant}`}
                  style={{ '--cover-template-accent': selectedTheme.swatches[1] } as CSSProperties}
                  aria-hidden="true"
                >
                  {selectedAsset && <ScrapbookMediaImage asset={selectedAsset} alt="" />}
                  <span className="scrapbook-cover-template__preview-shade" />
                  <i>{dateLabel}</i><b>{title || '旅の記録'}</b><small>{subtitle || 'TRAVEL JOURNAL'}</small>
                </span>
                <span className="scrapbook-cover-template__copy"><strong>{template.name}</strong><small>{template.description}</small></span>
                <span className="scrapbook-cover-template__state">{applied ? '使用中' : previewing ? 'プレビュー中' : ''}</span>
              </button>
            );
          })}
        </div>
        <div className="scrapbook-cover-template__apply">
          <p><strong>{candidate.name}</strong>を大きなプレビューに表示しています。</p>
          <Button variant="primary" disabled={candidateId === appliedTemplateId} onClick={onApplyTemplate}>このデザインを使用</Button>
        </div>
      </section>

      <section className="scrapbook-cover-panel" aria-labelledby="cover-theme-heading">
        <header className="scrapbook-cover-panel__heading">
          <span>Atmosphere</span>
          <h3 id="cover-theme-heading">作品テーマ</h3>
          <p>表紙だけでなく、この旅行雑誌全体の色と雰囲気が変わります。</p>
        </header>
        <div className="scrapbook-cover-theme-grid" role="radiogroup" aria-label="作品テーマ">
          {COVER_THEMES.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <button
                key={theme.id}
                type="button"
                className={`scrapbook-cover-theme${selected ? ' is-selected' : ''}`}
                role="radio"
                aria-checked={selected}
                onClick={() => onThemeChange(theme.id)}
              >
                <span className="scrapbook-cover-theme__sample" style={{ '--theme-paper': theme.swatches[0], '--theme-accent': theme.swatches[1], '--theme-ink': theme.swatches[2] } as CSSProperties} aria-hidden="true">
                  <i>{theme.previewText}</i><b>A quiet journey</b>
                </span>
                <span><strong>{theme.name}</strong><small>{theme.description}</small></span>
                {selected && <em>選択中</em>}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
