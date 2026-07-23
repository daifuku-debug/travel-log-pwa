import { useState, type KeyboardEvent } from 'react';
import type { MediaAsset, ScrapbookCoverLayout } from '../../../domain/models/scrapbook';
import type { TripDetail } from '../../trips/tripService';
import type { ScrapbookPageDraft } from '../scrapbookEditorDraft';
import { CoverDesignPanel } from './CoverDesignPanel';
import { CoverPhotoPanel } from './CoverPhotoPanel';
import { CoverTextPanel } from './CoverTextPanel';
import type { PendingCoverPhoto } from '../useCoverPhotoImport';

type CoverEditorTab = 'photo' | 'design' | 'text';

const TABS: Array<{ id: CoverEditorTab; label: string }> = [
  { id: 'photo', label: '写真' },
  { id: 'design', label: 'デザイン' },
  { id: 'text', label: '文字' },
];

export function CoverEditorPanel({
  draft,
  mediaAssets,
  tripDetail,
  previewTemplateId,
  onPreviewTemplate,
  onApplyTemplate,
  pendingPhoto,
  onChoosePhotoFile,
  onApplyPendingPhoto,
  onCancelPendingPhoto,
  onPendingPhotoDestinationChange,
  onChange,
}: {
  draft: ScrapbookPageDraft;
  mediaAssets: MediaAsset[];
  tripDetail: TripDetail;
  previewTemplateId?: ScrapbookCoverLayout;
  onPreviewTemplate: (templateId: ScrapbookCoverLayout) => void;
  onApplyTemplate: () => void;
  pendingPhoto?: PendingCoverPhoto;
  onChoosePhotoFile: (file: File) => void;
  onApplyPendingPhoto: () => void;
  onCancelPendingPhoto: () => void;
  onPendingPhotoDestinationChange: (destination: PendingCoverPhoto['destination']) => void;
  onChange: (draft: ScrapbookPageDraft) => void;
}) {
  const [activeTab, setActiveTab] = useState<CoverEditorTab>('photo');

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tabId: CoverEditorTab) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = TABS.findIndex((tab) => tab.id === tabId);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? TABS.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    const nextTab = TABS[nextIndex];
    if (!nextTab) return;
    setActiveTab(nextTab.id);
    requestAnimationFrame(() => document.getElementById(`cover-editor-tab-${nextTab.id}`)?.focus());
  }

  return (
    <div className="scrapbook-cover-editor">
      <div className="scrapbook-cover-editor__tabs" role="tablist" aria-label="表紙編集項目">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`cover-editor-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`cover-editor-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id={`cover-editor-panel-${activeTab}`}
        className="scrapbook-cover-editor__tab-panel"
        role="tabpanel"
        aria-labelledby={`cover-editor-tab-${activeTab}`}
      >
        {activeTab === 'photo' && (
          <CoverPhotoPanel
            selectedPhotoId={draft.coverPhotoId}
            mediaAssets={mediaAssets}
            tripDetail={tripDetail}
            pendingPhoto={pendingPhoto}
            onChooseFile={onChoosePhotoFile}
            onApplyPending={onApplyPendingPhoto}
            onCancelPending={onCancelPendingPhoto}
            onDestinationChange={onPendingPhotoDestinationChange}
            onSelect={(coverPhotoId) => onChange({ ...draft, coverPhotoId })}
          />
        )}
        {activeTab === 'design' && (
          <CoverDesignPanel
            appliedTemplateId={draft.coverLayout}
            previewTemplateId={previewTemplateId}
            themeId={draft.coverThemeId}
            title={draft.coverTitle}
            subtitle={draft.coverSubtitle}
            startDate={tripDetail.trip.startDate}
            endDate={tripDetail.trip.endDate}
            selectedPhotoId={draft.coverPhotoId}
            mediaAssets={mediaAssets}
            onPreviewTemplate={onPreviewTemplate}
            onApplyTemplate={onApplyTemplate}
            onThemeChange={(coverThemeId) => onChange({ ...draft, coverThemeId })}
          />
        )}
        {activeTab === 'text' && (
          <CoverTextPanel draft={draft} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
