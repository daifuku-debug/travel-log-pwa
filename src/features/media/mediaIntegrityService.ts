import type { MediaIntegrityReport } from '../../domain/media/mediaIntegrity.ts';
import { localMediaIntegrityDataSource } from '../../infrastructure/localDb/mediaIntegrityDataSource.ts';
import {
  scanMediaAssetIntegrityWithDependencies,
} from './mediaIntegrityLogic.ts';

export {
  MediaIntegrityScanError,
  type MediaIntegrityScanErrorCode,
  type MediaIntegrityScanStage,
} from './mediaIntegrityLogic.ts';

export function scanMediaAssetIntegrity(): Promise<MediaIntegrityReport> {
  return scanMediaAssetIntegrityWithDependencies(localMediaIntegrityDataSource);
}
