import { useState } from 'react';
import { equipTitle, listTitleViews } from '../features/rpg/titleService';
import { ensureRpgProgressInitialized } from '../features/rpg/rpgProgressService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function RpgTitlesPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, error, loading } = useAsyncData(async () => {
    await ensureRpgProgressInitialized();
    return listTitleViews();
  }, [reloadKey]);

  return (
    <>
      <section className="page-heading">
        <h1>称号</h1>
        <p>獲得した称号からプロフィールに表示するメイン称号を選べます。</p>
      </section>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="list">
          {data.map((view) => (
            <div className="list-item" key={view.master.id}>
              <div>
                <p className="list-item__title">{view.isUnlocked ? view.master.name : '未獲得の称号'}</p>
                <div className="list-item__meta">{view.isUnlocked ? view.master.description : `${view.progress} / ${view.master.conditionValue}`}</div>
              </div>
              {view.isUnlocked && (
                <button
                  className={view.userTitle?.isEquipped ? 'button button--primary' : 'button'}
                  type="button"
                  onClick={async () => {
                    await equipTitle(view.master.id);
                    setReloadKey((value) => value + 1);
                  }}
                >
                  {view.userTitle?.isEquipped ? '装備中' : '装備する'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
