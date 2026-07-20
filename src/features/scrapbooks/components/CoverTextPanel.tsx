import { CheckboxField, TextInput } from '../../../shared/ui';
import { getCoverTemplateDefinition, resolveCoverTitlePosition, type CoverTitlePosition } from '../coverDesignRegistry';
import type { ScrapbookPageDraft } from '../scrapbookEditorDraft';

const POSITION_LABELS: Record<CoverTitlePosition, string> = {
  'bottom-left': '左下',
  center: '中央',
  'bottom-right': '右下',
};

export function CoverTextPanel({
  draft,
  onChange,
}: {
  draft: ScrapbookPageDraft;
  onChange: (draft: ScrapbookPageDraft) => void;
}) {
  const template = getCoverTemplateDefinition(draft.coverLayout);
  const selectedPosition = resolveCoverTitlePosition(template.id, draft.coverTitlePosition);

  return (
    <div className="scrapbook-cover-text">
      <section className="scrapbook-cover-panel" aria-labelledby="cover-copy-heading">
        <header className="scrapbook-cover-panel__heading">
          <span>Title</span>
          <h3 id="cover-copy-heading">表紙に残す言葉</h3>
        </header>
        <div className="scrapbook-cover-text__fields">
          <TextInput label="表紙タイトル" value={draft.coverTitle} maxLength={120} required onChange={(event) => onChange({ ...draft, coverTitle: event.target.value })} />
          <TextInput label="サブタイトル" value={draft.coverSubtitle} maxLength={160} helperText="空欄の場合は旅行の目的やメモを表示します。" onChange={(event) => onChange({ ...draft, coverSubtitle: event.target.value })} />
        </div>
      </section>

      <section className="scrapbook-cover-panel" aria-labelledby="cover-position-heading">
        <header className="scrapbook-cover-panel__heading">
          <span>Placement</span>
          <h3 id="cover-position-heading">文字位置</h3>
        </header>
        <div className="scrapbook-cover-position-grid" role="radiogroup" aria-label="表紙の文字位置">
          {template.capabilities.titlePositions.map((position) => {
            const selected = position === selectedPosition;
            return (
              <button
                key={position}
                type="button"
                className={`scrapbook-cover-position is-${position}${selected ? ' is-selected' : ''}`}
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...draft, coverTitlePosition: position })}
              >
                <span aria-hidden="true"><i /><i /><i /></span>
                <strong>{POSITION_LABELS[position]}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <section className="scrapbook-cover-panel" aria-labelledby="cover-display-heading">
        <header className="scrapbook-cover-panel__heading">
          <span>Details</span>
          <h3 id="cover-display-heading">表示する情報</h3>
        </header>
        <div className="scrapbook-cover-editor__toggles">
          <CheckboxField label="日付を表示" checked={draft.coverShowDate} onChange={(event) => onChange({ ...draft, coverShowDate: event.target.checked })} />
          <CheckboxField label="場所を表示" checked={draft.coverShowLocation} onChange={(event) => onChange({ ...draft, coverShowLocation: event.target.checked })} />
          <CheckboxField label="サブタイトルを表示" checked={draft.coverShowSubtitle} onChange={(event) => onChange({ ...draft, coverShowSubtitle: event.target.checked })} />
        </div>
      </section>
    </div>
  );
}
