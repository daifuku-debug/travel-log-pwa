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
    <div className="scrapbook-save-bar" role="region" aria-label="編集内容の保存">
      <span className={dirty ? 'is-dirty' : ''}>{dirty ? '変更があります' : '保存済み'}</span>
      <div>
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={onDiscard}>変更を破棄</Button>
        <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={onSave}>保存</Button>
      </div>
    </div>
  );
}
