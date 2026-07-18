import { useEffect, useMemo, useState } from 'react';
import type { PrefectureVisitStatus } from '../../../domain/models/japanConquest';
import { STATUS_LABELS, type PrefectureView } from '../japanConquestLogic';

interface GeoFeature {
  type: 'Feature';
  properties: {
    shapeISO?: string;
    shapeName?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJson {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

interface JapanGeoMapProps {
  views: PrefectureView[];
  selectedCode?: string;
  onSelect: (code: string) => void;
}

const MAP_WIDTH = 640;
const MAP_HEIGHT = 760;
const PADDING = 24;

export function JapanGeoMap({ views, selectedCode, onSelect }: JapanGeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJson | undefined>();
  const [error, setError] = useState<string | undefined>();
  const viewByCode = useMemo(
    () => new Map(views.map((view) => [view.master.code, view])),
    [views],
  );

  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}maps/japan-prefectures.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error(`地図データの読み込みに失敗しました (${response.status})`);
        return response.json() as Promise<GeoJson>;
      })
      .then((data) => {
        if (active) setGeoJson(data);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : '地図データの読み込みに失敗しました');
      });
    return () => {
      active = false;
    };
  }, []);

  const projection = useMemo(() => {
    if (!geoJson) return undefined;
    const points = geoJson.features.flatMap((feature) => collectPoints(feature.geometry));
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const scale = Math.min(
      (MAP_WIDTH - PADDING * 2) / (maxLon - minLon),
      (MAP_HEIGHT - PADDING * 2) / (maxLat - minLat),
    );
    const xOffset = (MAP_WIDTH - (maxLon - minLon) * scale) / 2;
    const yOffset = (MAP_HEIGHT - (maxLat - minLat) * scale) / 2;
    return ([lon, lat]: number[]) => [
      xOffset + (lon - minLon) * scale,
      yOffset + (maxLat - lat) * scale,
    ];
  }, [geoJson]);

  if (error) return <div className="status-banner">{error}</div>;
  if (!geoJson || !projection) return <div className="status-banner">地図データを読み込み中...</div>;

  return (
    <div className="map-shell">
      <svg
        className="japan-map"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="日本制覇マップ"
      >
        {geoJson.features.map((feature) => {
          const code = codeFromShapeIso(feature.properties.shapeISO);
          const view = code ? viewByCode.get(code) : undefined;
          if (!code || !view) return null;
          const status = view.visit.status;
          return (
            <path
              key={code}
              className={`prefecture-shape status-${status} ${selectedCode === code ? 'selected' : ''}`}
              d={geometryToPath(feature.geometry, projection)}
              tabIndex={0}
              role="button"
              aria-label={`${view.master.nameJa}: ${STATUS_LABELS[status]}`}
              onClick={() => onSelect(code)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(code);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function codeFromShapeIso(shapeIso?: string): string | undefined {
  const match = shapeIso?.match(/^JP-(\d{2})$/);
  return match?.[1];
}

function collectPoints(geometry: GeoFeature['geometry']): number[][] {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons.flatMap((polygon) => polygon.flatMap((ring) => ring));
}

function geometryToPath(
  geometry: GeoFeature['geometry'],
  project: (point: number[]) => number[],
): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][];
  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring
            .map((point, index) => {
              const [x, y] = project(point);
              return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ') + ' Z',
        )
        .join(' '),
    )
    .join(' ');
}

export const STATUS_PATTERN_LABELS: Record<PrefectureVisitStatus, string> = {
  unvisited: '薄い背景',
  passed: '斜線',
  visited: '塗り',
  stayed: '濃い塗りと太枠',
};
