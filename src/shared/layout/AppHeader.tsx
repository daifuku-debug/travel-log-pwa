import { Badge } from '../ui/Badge';

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-brand">
          <span className="app-brand__name">旅ログ</span>
          <span className="app-brand__tagline">旅行・お出かけ・コレクション記録</span>
        </div>
        <Badge variant="success" className="sync-pill">端末内保存</Badge>
      </div>
    </header>
  );
}
