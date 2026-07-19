import { Button } from '../../../shared/ui';

export function SaveBar({
  dirty,
  saving,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className={`scrapbook-save-bar${dirty ? ' is-dirty' : ' is-saved'}`} role="region" aria-label="編集内容の保存">
      <span aria-live="polite">{dirty ? '未保存の変更があります' : '保存済み'}</span>
      <div>
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={onDiscard}>元に戻す</Button>
        <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={onSave}>保存する</Button>
      </div>
    </div>
  );
}
