import { useState, type FormEvent } from 'react';
import type { RpgQuest } from '../domain/models/rpg';
import {
  completeCustomQuest,
  createCustomQuest,
  deleteCustomQuest,
  listQuests,
  updateCustomQuest,
  type CustomQuestInput,
} from '../features/rpg/questService';
import { ensureRpgProgressInitialized } from '../features/rpg/rpgProgressService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const EMPTY_INPUT: CustomQuestInput = {
  title: '',
  description: '',
  expiresAt: '',
  targetValue: 1,
  rewardExp: 0,
  category: '',
  conditionType: 'manual',
  note: '',
};

export function RpgQuestsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<RpgQuest | undefined>();
  const [input, setInput] = useState<CustomQuestInput>(EMPTY_INPUT);
  const [formError, setFormError] = useState('');
  const { data, error, loading } = useAsyncData(async () => {
    await ensureRpgProgressInitialized();
    return listQuests();
  }, [reloadKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    try {
      if (editing) {
        await updateCustomQuest(editing.id, input);
      } else {
        await createCustomQuest(input);
      }
      setInput(EMPTY_INPUT);
      setEditing(undefined);
      setReloadKey((value) => value + 1);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>クエスト</h1>
        <p>次に試したくなる旅の目標を管理します。</p>
      </section>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="grid">
          <section className="card">
            <h2>{editing ? 'クエストを編集' : 'ユーザー作成クエスト'}</h2>
            <form className="form form--compact" onSubmit={handleSubmit}>
              {formError && <div className="form-errors">{formError}</div>}
              <label className="field">
                <span>クエスト名</span>
                <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
              </label>
              <label className="field">
                <span>説明</span>
                <input value={input.description} onChange={(event) => setInput({ ...input, description: event.target.value })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>期限</span>
                  <input type="date" value={input.expiresAt} onChange={(event) => setInput({ ...input, expiresAt: event.target.value })} />
                </label>
                <label className="field">
                  <span>カテゴリ</span>
                  <input value={input.category} onChange={(event) => setInput({ ...input, category: event.target.value })} />
                </label>
                <label className="field">
                  <span>目標回数</span>
                  <input type="number" min="1" value={input.targetValue} onChange={(event) => setInput({ ...input, targetValue: Number(event.target.value) })} />
                </label>
                <label className="field">
                  <span>報酬EXP</span>
                  <input type="number" min="0" max="500" value={input.rewardExp} onChange={(event) => setInput({ ...input, rewardExp: Number(event.target.value) })} />
                </label>
              </div>
              <label className="field">
                <span>メモ</span>
                <textarea rows={3} value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit">{editing ? '更新' : '追加'}</button>
                {editing && (
                  <button className="button" type="button" onClick={() => { setEditing(undefined); setInput(EMPTY_INPUT); }}>
                    キャンセル
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="card">
            <h2>クエスト一覧</h2>
            <div className="list">
              {data.map((quest) => (
                <div className="list-item" key={quest.id}>
                  <div>
                    <p className="list-item__title">{quest.title}</p>
                    <div className="list-item__meta">{quest.description}</div>
                    <div className="list-item__meta">{quest.currentValue} / {quest.targetValue}・{quest.rewardExp} EXP・{quest.status}</div>
                  </div>
                  {quest.source === 'user' && (
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => { setEditing(quest); setInput(toInput(quest)); }}>編集</button>
                      <button className="button" type="button" onClick={async () => { await completeCustomQuest(quest.id); setReloadKey((value) => value + 1); }}>完了</button>
                      <button className="button button--danger" type="button" onClick={async () => {
                        if (!window.confirm('このクエストを削除しますか？')) return;
                        await deleteCustomQuest(quest.id);
                        setReloadKey((value) => value + 1);
                      }}>削除</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function toInput(quest: RpgQuest): CustomQuestInput {
  return {
    title: quest.title,
    description: quest.description,
    expiresAt: quest.expiresAt ?? '',
    targetValue: quest.targetValue,
    rewardExp: quest.rewardExp,
    category: quest.category,
    conditionType: quest.conditionType,
    note: quest.note ?? '',
  };
}
