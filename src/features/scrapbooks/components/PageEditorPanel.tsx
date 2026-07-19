import type { ScrapbookPage } from '../../../domain/models/scrapbook';
import { CheckboxField, TextInput } from '../../../shared/ui';
import type { ScrapbookPageDraft } from '../scrapbookEditorDraft';

export function PageEditorPanel({
  page,
  draft,
  onChange,
}: {
  page: ScrapbookPage;
  draft: ScrapbookPageDraft;
  onChange: (draft: ScrapbookPageDraft) => void;
}) {
  const isCover = page.pageKind === 'cover';

  return (
    <div className="scrapbook-page-editor-panel">
      <TextInput
        label="ページ名"
        value={draft.pageTitle}
        maxLength={80}
        required
        onChange={(event) => onChange({ ...draft, pageTitle: event.target.value })}
        helperText="ページ一覧で使う名前です。"
      />

      {isCover && (
        <>
          <TextInput
            label="表紙タイトル"
            value={draft.coverTitle}
            maxLength={120}
            required
            onChange={(event) => onChange({ ...draft, coverTitle: event.target.value })}
          />
          <TextInput
            label="サブタイトル"
            value={draft.coverSubtitle}
            maxLength={160}
            onChange={(event) => onChange({ ...draft, coverSubtitle: event.target.value })}
            helperText="空欄の場合は旅行の目的やメモを表示します。"
          />
        </>
      )}

      <CheckboxField
        label="このページを表示する"
        description={isCover ? '表紙は常に表示されます。' : '非表示にしてもページの内容は削除されません。'}
        checked={isCover || !draft.isHidden}
        disabled={isCover}
        onChange={(event) => onChange({ ...draft, isHidden: !event.target.checked })}
      />
    </div>
  );
}
