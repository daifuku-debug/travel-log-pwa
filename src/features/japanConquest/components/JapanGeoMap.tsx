import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
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
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export function JapanGeoMap({ views, selectedCode, onSelect }: JapanGeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJson | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; viewportX: number; viewportY: number } | undefined>(undefined);
  const suppressClickRef = useRef(false);
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

  function zoomAt(nextScale: number, centerX = MAP_WIDTH / 2, centerY = MAP_HEIGHT / 2) {
    setViewport((current) => {
      const scale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      const ratio = scale / current.scale;
      return clampViewport({
        scale,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      });
    });
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const point = svgPointFromClient(event.currentTarget, event.clientX, event.clientY);
    const delta = event.deltaY > 0 ? 0.86 : 1.16;
    zoomAt(viewport.scale * delta, point.x, point.y);
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    };
    suppressClickRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 4) {
      suppressClickRef.current = true;
    }
    const movement = clientMovementToSvg(event.currentTarget, event.clientX - start.x, event.clientY - start.y);
    setViewport((current) => clampViewport({
      ...current,
      x: start.viewportX + movement.x,
      y: start.viewportY + movement.y,
    }));
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragStartRef.current?.pointerId === event.pointerId) {
      dragStartRef.current = undefined;
      setDragging(false);
    }
  }

  function handleShapeClick(code: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(code);
  }

  return (
    <>
      <div className="map-toolbar" aria-label="地図操作">
        <button className="button" type="button" onClick={() => zoomAt(viewport.scale * 1.35)}>
          拡大
        </button>
        <button className="button" type="button" onClick={() => zoomAt(viewport.scale / 1.35)}>
          縮小
        </button>
        <button className="button" type="button" onClick={() => setViewport({ scale: 1, x: 0, y: 0 })}>
          リセット
        </button>
        <span className="muted">地図上でスクロール/ドラッグできます</span>
      </div>
      <div className="map-shell">
      <svg
        className={`japan-map ${dragging ? 'dragging' : ''}`}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        role="img"
        aria-label="日本制覇マップ"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <g transform={`translate(${viewport.x.toFixed(2)} ${viewport.y.toFixed(2)}) scale(${viewport.scale.toFixed(3)})`}>
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
                onClick={() => handleShapeClick(code)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(code);
                }}
              />
            );
          })}
        </g>
      </svg>
      </div>
    </>
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
  lived: '紫の塗りと太枠',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampViewport(viewport: { scale: number; x: number; y: number }) {
  if (viewport.scale <= 1) return { scale: 1, x: 0, y: 0 };
  const minX = MAP_WIDTH - MAP_WIDTH * viewport.scale;
  const minY = MAP_HEIGHT - MAP_HEIGHT * viewport.scale;
  return {
    scale: viewport.scale,
    x: clamp(viewport.x, minX, 0),
    y: clamp(viewport.y, minY, 0),
  };
}

function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * MAP_WIDTH,
    y: ((clientY - rect.top) / rect.height) * MAP_HEIGHT,
  };
}

function clientMovementToSvg(svg: SVGSVGElement, deltaX: number, deltaY: number) {
  const rect = svg.getBoundingClientRect();
  return {
    x: (deltaX / rect.width) * MAP_WIDTH,
    y: (deltaY / rect.height) * MAP_HEIGHT,
  };
}
