export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-brand">
          <span className="app-brand__name">旅ログ</span>
          <span className="app-brand__tagline">写真と地図で、旅を積み重ねる</span>
        </div>
        <span className="app-storage-status"><i aria-hidden="true" />端末内保存</span>
      </div>
    </header>
  );
}
