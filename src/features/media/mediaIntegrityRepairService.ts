import type { MediaIntegrityIssue } from '../../domain/media/mediaIntegrity.ts';
import { localMediaIntegrityRepairDataSource } from '../../infrastructure/localDb/mediaIntegrityRepairDataSource.ts';
import { createMediaThumbnailFromBlob } from './mediaAssetValidation.ts';
import { scanMediaAssetIntegrity } from './mediaIntegrityService.ts';
import {
  repairMediaIntegrityIssuesWithDependencies,
  type MediaIntegrityRepairBatchResult,
} from './mediaIntegrityRepairLogic.ts';

export {
  getMediaIntegrityRepairAction,
  isDestructiveMediaIntegrityRepair,
  type MediaIntegrityRepairAction,
  type MediaIntegrityRepairBatchResult,
  type MediaIntegrityRepairCode,
  type MediaIntegrityRepairResult,
  type MediaIntegrityRepairStatus,
} from './mediaIntegrityRepairLogic.ts';

export function repairMediaIntegrityIssues(
  issues: readonly MediaIntegrityIssue[],
): Promise<MediaIntegrityRepairBatchResult> {
  return repairMediaIntegrityIssuesWithDependencies(issues, {
    ...localMediaIntegrityRepairDataSource,
    createThumbnail: createMediaThumbnailFromBlob,
    scan: scanMediaAssetIntegrity,
  });
}
