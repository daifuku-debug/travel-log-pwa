import type { ReactNode } from 'react';
import type { MediaAsset, ScrapbookCoverLayout, ScrapbookThemeId } from '../../../domain/models/scrapbook';
import { CheckboxField, SegmentedControl, TextInput } from '../../../shared/ui';
import type { TripDetail } from '../../trips/tripService';
import { TripJournalVisual } from '../../trips/components/TripJournalVisual';
import type { ScrapbookPageDraft } from '../scrapbookEditorDraft';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

const THEME_OPTIONS: Array<{ value: ScrapbookThemeId; label: string }> = [
  { value: 'classic', label: 'Classic' },
  { value: 'journal', label: 'Journal' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'adventure', label: 'Adventure' },
];

const LAYOUT_OPTIONS: Array<{ value: ScrapbookCoverLayout; label: string }> = [
  { value: 'magazine', label: 'Magazine' },
  { value: 'photo', label: 'Photo Full' },
  { value: 'journal', label: 'Journal' },
];

const POSITION_OPTIONS = [
  { value: 'bottom-left', label: '左下' },
  { value: 'center', label: '中央' },
  { value: 'bottom-right', label: '右下' },
];

export function CoverEditorPanel({
  draft,
  mediaAssets,
  tripDetail,
  onChange,
}: {
  draft: ScrapbookPageDraft;
  mediaAssets: MediaAsset[];
  tripDetail: TripDetail;
  onChange: (draft: ScrapbookPageDraft) => void;
}) {
  return (
    <div className="scrapbook-cover-editor">
      <EditorSection title="写真" description="この旅に保存されている写真から表紙を選びます。">
        {mediaAssets.length > 0 ? (
          <div className="scrapbook-cover-editor__photos" role="radiogroup" aria-label="表紙写真">
            {mediaAssets.map((asset) => {
              const selected = draft.coverPhotoId === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`scrapbook-cover-editor__photo${selected ? ' is-selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${asset.originalFileName || '旅行写真'}を表紙にする${selected ? '、現在選択中' : ''}`}
                  onClick={() => onChange({ ...draft, coverPhotoId: asset.id })}
                >
                  <ScrapbookMediaImage asset={asset} alt="" />
                  {selected && <span>選択中</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="scrapbook-cover-editor__fallback">
            <TripJournalVisual
              trip={tripDetail.trip}
              placeNames={tripDetail.places.map((place) => place.name)}
              alt=""
            />
            <p>写真が追加されるまでは、旅行の内容から作った表紙を使用します。</p>
          </div>
        )}
      </EditorSection>

      <EditorSection title="デザイン">
        <ControlGroup label="作品テーマ">
          <SegmentedControl label="作品テーマ" value={draft.coverThemeId} options={THEME_OPTIONS} onChange={(coverThemeId) => onChange({ ...draft, coverThemeId })} />
        </ControlGroup>
        <ControlGroup label="表紙レイアウト">
          <SegmentedControl label="表紙レイアウト" value={draft.coverLayout} options={LAYOUT_OPTIONS} onChange={(coverLayout) => onChange({ ...draft, coverLayout })} />
        </ControlGroup>
        <ControlGroup label="文字位置">
          <SegmentedControl label="表紙の文字位置" value={draft.coverTitlePosition} options={POSITION_OPTIONS} onChange={(coverTitlePosition) => onChange({ ...draft, coverTitlePosition })} />
        </ControlGroup>
      </EditorSection>

      <EditorSection title="表示">
        <div className="scrapbook-cover-editor__toggles">
          <CheckboxField label="日付を表示" checked={draft.coverShowDate} onChange={(event) => onChange({ ...draft, coverShowDate: event.target.checked })} />
          <CheckboxField label="場所を表示" checked={draft.coverShowLocation} onChange={(event) => onChange({ ...draft, coverShowLocation: event.target.checked })} />
          <CheckboxField label="サブタイトルを表示" checked={draft.coverShowSubtitle} onChange={(event) => onChange({ ...draft, coverShowSubtitle: event.target.checked })} />
        </div>
      </EditorSection>

      <EditorSection title="テキスト">
        <TextInput label="表紙タイトル" value={draft.coverTitle} maxLength={120} required onChange={(event) => onChange({ ...draft, coverTitle: event.target.value })} />
        <TextInput label="サブタイトル" value={draft.coverSubtitle} maxLength={160} helperText="空欄の場合は旅行の目的やメモを表示します。" onChange={(event) => onChange({ ...draft, coverSubtitle: event.target.value })} />
      </EditorSection>
    </div>
  );
}

function EditorSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="scrapbook-cover-editor__section"><header><h3>{title}</h3>{description && <p>{description}</p>}</header><div>{children}</div></section>;
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="scrapbook-cover-editor__control"><span>{label}</span>{children}</div>;
}
