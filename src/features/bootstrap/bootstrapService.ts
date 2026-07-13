import { seedSampleData } from '../../infrastructure/localDb/sampleData';
import { toAppError } from '../../shared/errors';

let bootstrapPromise: Promise<void> | undefined;

export function bootstrapAppData(): Promise<void> {
  bootstrapPromise ??= seedSampleData().catch((error: unknown) => {
    throw toAppError(error, '初期データの準備に失敗しました');
  });
  return bootstrapPromise;
}
