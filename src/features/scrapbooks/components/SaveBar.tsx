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
    <div className={`scrapbook-save-bar${dirty ? ' is-dirty' : ' is-saved'}`} role="region" aria-label="旅行記の更新">
      <span aria-live="polite">{dirty ? '編集内容があります' : '最新の状態です'}</span>
      <div>
        <Button variant="ghost" size="sm" disabled={!dirty || saving} onClick={onDiscard}>元に戻す</Button>
        <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={onSave}>記録を更新</Button>
      </div>
    </div>
  );
}
