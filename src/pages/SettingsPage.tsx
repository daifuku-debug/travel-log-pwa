export function SettingsPage() {
  return (
    <>
      <section className="page-heading">
        <h1>設定</h1>
        <p>インポート、エクスポート、同期、ログイン状態の管理をここに追加していきます。</p>
      </section>

      <div className="grid">
        <section className="card">
          <h2>保存先</h2>
          <p className="muted">現在は端末内のIndexedDBに保存します。</p>
        </section>

        <section className="card">
          <h2>Cloudflare同期</h2>
          <p className="muted">Workers + D1の同期Repositoryを後続フェーズで追加できる構成です。</p>
        </section>

        <section className="card">
          <h2>PWA</h2>
          <p className="muted">ホーム画面に追加して、インストール済みアプリのように起動できます。</p>
        </section>
      </div>
    </>
  );
}
