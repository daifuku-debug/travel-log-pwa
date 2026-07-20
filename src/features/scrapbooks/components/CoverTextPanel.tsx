import type { ScrapbookPageDraft } from '../scrapbookEditorDraft';
import { CoverTextControls } from './CoverTextControls';

export function CoverTextPanel({ draft, onChange }: {
  draft: ScrapbookPageDraft;
  onChange: (draft: ScrapbookPageDraft) => void;
}) {
  return (
    <div className="scrapbook-cover-text">
      <CoverTextControls draft={draft} onChange={onChange} />
    </div>
  );
}
