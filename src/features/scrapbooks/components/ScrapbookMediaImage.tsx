import { useEffect, useState } from 'react';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import { Skeleton } from '../../../shared/ui';
import { createMediaObjectUrl } from '../scrapbookService';

export function ScrapbookMediaImage({
  asset,
  alt,
  className = '',
  loading = 'lazy',
}: {
  asset: MediaAsset;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
}) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    setUrl(undefined);
    setError('');
    void createMediaObjectUrl(asset, 'thumbnail')
      .then((nextUrl) => {
        if (cancelled) {
          if (nextUrl) URL.revokeObjectURL(nextUrl);
          return;
        }
        objectUrl = nextUrl;
        setUrl(nextUrl);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '写真を読み込めません。');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset]);

  if (error) {
    return <div className={`scrapbook-media-placeholder scrapbook-media-placeholder--error ${className}`.trim()} role="img" aria-label={alt}>{error}</div>;
  }
  if (!url) {
    return <div className={`scrapbook-media-placeholder ${className}`.trim()} aria-label="写真を読み込み中"><Skeleton variant="block" /></div>;
  }
  return <img className={className} src={url} alt={alt} loading={loading} decoding="async" />;
}
