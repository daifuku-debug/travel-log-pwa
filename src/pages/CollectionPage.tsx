import { useMemo, useState, type FormEvent } from 'react';
import type { Collection, CollectionCategory, CollectionItem } from '../domain/models/collection';
import {
  createCollection,
  createCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  listCollectionDetails,
  setCollectionItemVisited,
  updateCollection,
  updateCollectionItem,
  type CollectionInput,
  type CollectionItemInput,
} from '../features/collections/collectionService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, InlineError, NavigationListItem, PageHeader, ProgressBar } from '../shared/ui';

const EMPTY_COLLECTION: CollectionInput = {
  name: '',
  category: 'custom',
  description: '',
};

const EMPTY_ITEM: CollectionItemInput = {
  name: '',
  prefecture: '',
  country: '',
  address: '',
  officialUrl: '',
  memo: '',
};

const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  castle: '城',
  station: '駅',
  worldHeritage: '世界遺産',
  custom: 'その他',
};

export function CollectionPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingCollection, setEditingCollection] = useState<Collection | undefined>();
  const [collectionInput, setCollectionInput] = useState<CollectionInput>(EMPTY_COLLECTION);
  const [editingItem, setEditingItem] = useState<CollectionItem | undefined>();
  const [itemCollectionId, setItemCollectionId] = useState<string | undefined>();
  const [itemInput, setItemInput] = useState<CollectionItemInput>(EMPTY_ITEM);
  const [formError, setFormError] = useState('');
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const { data: collections, error, loading } = useAsyncData(listCollectionDetails, [reloadKey]);
  const overall = useMemo(() => {
    const total = collections?.reduce((sum, collection) => sum + collection.totalCount, 0) ?? 0;
    const visited = collections?.reduce((sum, collection) => sum + collection.visitedCount, 0) ?? 0;
    return { total, visited, rate: total === 0 ? 0 : Math.round((visited / total) * 100) };
  }, [collections]);

  function reload() {
    setReloadKey((value) => value + 1);
  }

  function toggleCollection(collectionId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  function startEditCollection(collection: Collection) {
    setShowCollectionForm(true);
    setEditingCollection(collection);
    setCollectionInput({
      name: collection.name,
      category: collection.category,
      description: collection.description ?? '',
    });
  }

  function resetCollectionForm() {
    setEditingCollection(undefined);
    setCollectionInput(EMPTY_COLLECTION);
    setShowCollectionForm(false);
  }

  function startCreateItem(collectionId: string) {
    setEditingItem(undefined);
    setItemCollectionId(collectionId);
    setItemInput(EMPTY_ITEM);
    setOpenIds((current) => new Set(current).add(collectionId));
  }

  function startEditItem(item: CollectionItem) {
    setEditingItem(item);
    setItemCollectionId(item.collectionId);
    setItemInput({
      name: item.name,
      prefecture: item.prefecture ?? '',
      country: item.country ?? '',
      address: item.address ?? '',
      officialUrl: item.officialUrl ?? '',
      memo: item.memo ?? '',
    });
    setOpenIds((current) => new Set(current).add(item.collectionId));
  }

  function resetItemForm() {
    setEditingItem(undefined);
    setItemCollectionId(undefined);
    setItemInput(EMPTY_ITEM);
  }

  async function handleCollectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, collectionInput);
      } else {
        await createCollection(collectionInput);
      }
      resetCollectionForm();
      reload();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemCollectionId) return;
    setFormError('');
    try {
      if (editingItem) {
        await updateCollectionItem(editingItem.id, itemInput);
      } else {
        await createCollectionItem(itemCollectionId, itemInput);
      }
      resetItemForm();
      reload();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  return (
    <>
      <PageHeader
        title="コレクション"
        description="城、駅、世界遺産など、旅で集めた記録"
        actions={<Button variant="primary" onClick={() => setShowCollectionForm(true)}>コレクションを追加</Button>}
      />

      {loading && <LoadingState variant="skeleton" message="コレクションを読み込み中..." />}
      {error && <ErrorState error={error} />}

      {!loading && !error && (
      <div className="collection-page">
        {formError && <InlineError message={formError} />}

        <section className="collection-overview" aria-labelledby="collection-overview-title">
          <div className="collection-overview__head">
            <div><span>全体の達成率</span><strong id="collection-overview-title">{overall.rate}%</strong></div>
            <p>{overall.visited} / {overall.total} 項目を訪問済み</p>
          </div>
          <ProgressBar label="コレクション全体の達成率" value={overall.visited} max={Math.max(1, overall.total)} valueText={`${overall.rate}%`} />
        </section>

        <Card title="公式の城コレクション" description="日本100名城・続日本100名城の全200城を記録できます。">
          <div className="navigation-list">
            <NavigationListItem to="/castles" title="城コレクションを見る" description="登城、スタンプ、御城印の進捗を確認" icon="城" badge={<Badge variant="info">200城</Badge>} />
          </div>
        </Card>

        {showCollectionForm && <Card title={editingCollection ? 'コレクションを編集' : 'コレクションを追加'}>
          <form className="form form--compact" onSubmit={handleCollectionSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>名前</span>
                <input
                  value={collectionInput.name}
                  onChange={(event) => setCollectionInput({ ...collectionInput, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>カテゴリ</span>
                <select
                  value={collectionInput.category}
                  onChange={(event) => setCollectionInput({ ...collectionInput, category: event.target.value as CollectionCategory })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>説明</span>
              <input
                value={collectionInput.description}
                onChange={(event) => setCollectionInput({ ...collectionInput, description: event.target.value })}
              />
            </label>
            <div className="form-actions">
              <Button variant="primary" type="submit">
                {editingCollection ? '更新' : '追加'}
              </Button>
              <Button type="button" onClick={resetCollectionForm}>キャンセル</Button>
            </div>
          </form>
        </Card>}

        {itemCollectionId && (
          <Card title={editingItem ? '項目を編集' : '項目を追加'}>
            <form className="form form--compact" onSubmit={handleItemSubmit}>
              <label className="field">
                <span>項目名</span>
                <input value={itemInput.name} onChange={(event) => setItemInput({ ...itemInput, name: event.target.value })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>都道府県</span>
                  <input value={itemInput.prefecture} onChange={(event) => setItemInput({ ...itemInput, prefecture: event.target.value })} />
                </label>
                <label className="field">
                  <span>国</span>
                  <input value={itemInput.country} onChange={(event) => setItemInput({ ...itemInput, country: event.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>住所</span>
                <input value={itemInput.address} onChange={(event) => setItemInput({ ...itemInput, address: event.target.value })} />
              </label>
              <label className="field">
                <span>公式URL</span>
                <input value={itemInput.officialUrl} onChange={(event) => setItemInput({ ...itemInput, officialUrl: event.target.value })} />
              </label>
              <label className="field">
                <span>メモ</span>
                <textarea rows={3} value={itemInput.memo} onChange={(event) => setItemInput({ ...itemInput, memo: event.target.value })} />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {editingItem ? '項目を更新' : '項目を追加'}
                </button>
                <button className="button" type="button" onClick={resetItemForm}>
                  キャンセル
                </button>
              </div>
            </form>
          </Card>
        )}

        {collections && collections.length === 0 && (
          <EmptyState
            title="自分のコレクションはまだありません"
            description="駅、世界遺産、好きな場所など、集めたいテーマを自由に作れます。"
            action={<Button variant="primary" onClick={() => setShowCollectionForm(true)}>最初のコレクションを作成</Button>}
          />
        )}

        {collections && collections.length > 0 && (
          <section className="collection-section" aria-labelledby="collection-list-title">
            <div className="section-head"><h2 id="collection-list-title">自分のコレクション</h2><span className="muted">{collections.length}件</span></div>
          <div className="collection-card-grid">
            {collections.map((collection) => {
              const rate =
                collection.totalCount === 0
                  ? 0
                  : Math.round((collection.visitedCount / collection.totalCount) * 100);
              const isOpen = openIds.has(collection.id);
              return (
                <Card className="collection-card" key={collection.id}>
                  <div className="section-head">
                    <div>
                      <h2>{collection.name}</h2>
                      <p className="muted">{collection.description}</p>
                      <div className="list-item__meta">{CATEGORY_LABELS[collection.category]}</div>
                    </div>
                    <div className="inline-actions">
                      <Button size="sm" type="button" onClick={() => toggleCollection(collection.id)}>
                        {isOpen ? '閉じる' : '内訳'}
                      </Button>
                      <Button size="sm" type="button" onClick={() => startEditCollection(collection)}>編集</Button>
                      <Button size="sm" variant="danger" type="button" onClick={async () => {
                        if (!window.confirm(`「${collection.name}」と配下の項目を削除しますか？`)) return;
                        await deleteCollection(collection.id);
                        reload();
                      }}>
                        削除
                      </Button>
                    </div>
                  </div>
                  <ProgressBar label={`${collection.name}の達成率`} value={collection.visitedCount} max={Math.max(1, collection.totalCount)} valueText={`${collection.visitedCount} / ${collection.totalCount}・${rate}%`} />

                  <div className="form-actions collection-actions">
                    <Button type="button" onClick={() => startCreateItem(collection.id)}>項目を追加</Button>
                  </div>

                  {isOpen && (
                    <div className="collection-detail-list">
                      {collection.items.length === 0 ? (
                        <div className="empty-state">項目がまだありません。</div>
                      ) : collection.items.map(({ item, isVisited, lastVisitedAt }) => (
                        <div className="collection-detail-row" key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <div className="list-item__meta">
                              {[item.prefecture, item.country, item.address].filter(Boolean).join(' / ') || '場所情報なし'}
                            </div>
                            {item.memo && <div className="list-item__meta">{item.memo}</div>}
                          </div>
                          <div className="prefecture-row__right">
                            <Badge variant={isVisited ? 'success' : 'neutral'}>{isVisited ? '訪問済み' : '未訪問'}</Badge>
                            <span className="list-item__meta">{lastVisitedAt ? lastVisitedAt.slice(0, 10) : '-'}</span>
                            <div className="inline-actions">
                              <button
                                className="button"
                                type="button"
                                onClick={async () => {
                                  await setCollectionItemVisited(item.id, !isVisited);
                                  reload();
                                }}
                              >
                                {isVisited ? '未訪問にする' : '訪問済みにする'}
                              </button>
                              <button className="button" type="button" onClick={() => startEditItem(item)}>
                                編集
                              </button>
                              <button className="button button--danger" type="button" onClick={async () => {
                                if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
                                await deleteCollectionItem(item.id);
                                reload();
                              }}>
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          </section>
        )}
      </div>
      )}
    </>
  );
}
