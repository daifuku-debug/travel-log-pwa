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
const MAX_ZOOM = 6;
const COORDINATE_PRECISION = 1;
const DEFAULT_VIEWPORT = { scale: 1.6, x: -150, y: -150 };
const OKINAWA_CODE = '47';
const MAINLAND_MAX_LON = 146;
const OKINAWA_INSET = { x: 432, y: 590, width: 176, height: 116, padding: 14 };

export function JapanGeoMap({ views, selectedCode, onSelect }: JapanGeoMapProps) {
  const [geoJson, setGeoJson] = useState<GeoJson | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; viewportX: number; viewportY: number } | undefined>(undefined);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<
    { distance: number; centerX: number; centerY: number; scale: number; viewportX: number; viewportY: number } | undefined
  >(undefined);
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

  const projections = useMemo(() => {
    if (!geoJson) return undefined;
    const mainlandPoints = geoJson.features
      .filter((feature) => codeFromShapeIso(feature.properties.shapeISO) !== OKINAWA_CODE)
      .flatMap((feature) => collectPoints(feature.geometry))
      .filter(([lon]) => lon < MAINLAND_MAX_LON);
    const okinawaFeature = geoJson.features.find((feature) => codeFromShapeIso(feature.properties.shapeISO) === OKINAWA_CODE);
    return {
      mainland: createProjection(mainlandPoints, { x: PADDING, y: PADDING, width: MAP_WIDTH - PADDING * 2, height: MAP_HEIGHT - PADDING * 2 }),
      okinawa: okinawaFeature ? createProjection(collectPoints(okinawaFeature.geometry), OKINAWA_INSET) : undefined,
    };
  }, [geoJson]);

  if (error) return <div className="status-banner">{error}</div>;
  if (!geoJson || !projections) return <div className="status-banner">地図データを読み込み中...</div>;

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
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    suppressClickRef.current = false;
    if (activePointersRef.current.size >= 2) {
      dragStartRef.current = undefined;
      pinchStartRef.current = createPinchStart(event.currentTarget, activePointersRef.current, viewport);
      setDragging(false);
      return;
    }
    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      viewportX: viewport.x,
      viewportY: viewport.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (activePointersRef.current.size >= 2 && pinchStartRef.current) {
      suppressClickRef.current = true;
      const pinch = measurePinch(event.currentTarget, activePointersRef.current);
      if (!pinch) return;
      const nextScale = clamp(pinchStartRef.current.scale * (pinch.distance / pinchStartRef.current.distance), MIN_ZOOM, MAX_ZOOM);
      const ratio = nextScale / pinchStartRef.current.scale;
      setViewport(clampViewport({
        scale: nextScale,
        x: pinch.centerX - (pinchStartRef.current.centerX - pinchStartRef.current.viewportX) * ratio,
        y: pinch.centerY - (pinchStartRef.current.centerY - pinchStartRef.current.viewportY) * ratio,
      }));
      return;
    }
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
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = undefined;
    }
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
        <button className="button" type="button" onClick={() => setViewport(DEFAULT_VIEWPORT)}>
          リセット
        </button>
        <span className="muted">ピンチで拡大縮小、ドラッグで移動できます</span>
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
        <defs>
          <pattern id="map-pattern-passed" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="8" height="8" fill="#f6dda2" />
            <path d="M0 0v8" stroke="#c49244" strokeWidth="2" opacity="0.45" />
          </pattern>
          <pattern id="map-pattern-landed" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#f4c28d" />
            <circle cx="2" cy="2" r="1" fill="#8f5b31" opacity="0.32" />
            <circle cx="6" cy="6" r="1" fill="#8f5b31" opacity="0.26" />
          </pattern>
          <pattern id="map-pattern-stayed" width="9" height="9" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill="#367d7d" />
            <circle cx="2" cy="2" r="1.2" fill="#f3fbf8" opacity="0.22" />
            <circle cx="7" cy="7" r="1.2" fill="#f3fbf8" opacity="0.18" />
          </pattern>
          <pattern id="map-pattern-lived" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#7a618f" />
            <path d="M0 5h10M5 0v10" stroke="#fff6df" strokeWidth="1.2" opacity="0.22" />
          </pattern>
          <filter id="map-soft-shadow" x="-12%" y="-12%" width="124%" height="124%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.1" floodColor="#294246" floodOpacity="0.18" />
          </filter>
        </defs>
        <rect className="japan-map-bg" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} rx="22" />
        <g transform={`translate(${viewport.x.toFixed(2)} ${viewport.y.toFixed(2)}) scale(${viewport.scale.toFixed(3)})`}>
          {geoJson.features.filter((feature) => codeFromShapeIso(feature.properties.shapeISO) !== OKINAWA_CODE).map((feature) => {
            const code = codeFromShapeIso(feature.properties.shapeISO);
            const view = code ? viewByCode.get(code) : undefined;
            if (!code || !view) return null;
            const status = view.visit.status;
            return (
              <path
                key={code}
                className={`prefecture-shape status-${status} ${selectedCode === code ? 'selected' : ''}`}
                d={geometryToPath(feature.geometry, projections.mainland)}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
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
        {renderOkinawaInset(geoJson, projections.okinawa, viewByCode, selectedCode, handleShapeClick, onSelect)}
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
              return `${index === 0 ? 'M' : 'L'}${x.toFixed(COORDINATE_PRECISION)},${y.toFixed(COORDINATE_PRECISION)}`;
            })
            .join(' ') + ' Z',
        )
        .join(' '),
    )
    .join(' ');
}

function createProjection(
  points: number[][],
  bounds: { x: number; y: number; width: number; height: number; padding?: number },
): (point: number[]) => number[] {
  const padding = bounds.padding ?? 0;
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const drawableWidth = bounds.width - padding * 2;
  const drawableHeight = bounds.height - padding * 2;
  const scale = Math.min(drawableWidth / (maxLon - minLon), drawableHeight / (maxLat - minLat));
  const xOffset = bounds.x + padding + (drawableWidth - (maxLon - minLon) * scale) / 2;
  const yOffset = bounds.y + padding + (drawableHeight - (maxLat - minLat) * scale) / 2;
  return ([lon, lat]: number[]) => [
    xOffset + (lon - minLon) * scale,
    yOffset + (maxLat - lat) * scale,
  ];
}

function renderOkinawaInset(
  geoJson: GeoJson,
  projection: ((point: number[]) => number[]) | undefined,
  viewByCode: Map<string, PrefectureView>,
  selectedCode: string | undefined,
  handleShapeClick: (code: string) => void,
  onSelect: (code: string) => void,
) {
  const feature = geoJson.features.find((item) => codeFromShapeIso(item.properties.shapeISO) === OKINAWA_CODE);
  const view = viewByCode.get(OKINAWA_CODE);
  if (!feature || !view || !projection) return null;
  const status = view.visit.status;
  return (
    <g className="okinawa-inset">
      <rect
        className="okinawa-inset__frame"
        x={OKINAWA_INSET.x}
        y={OKINAWA_INSET.y}
        width={OKINAWA_INSET.width}
        height={OKINAWA_INSET.height}
        rx="14"
      />
      <text className="okinawa-inset__label" x={OKINAWA_INSET.x + 14} y={OKINAWA_INSET.y + 22}>沖縄</text>
      <path
        className={`prefecture-shape status-${status} ${selectedCode === OKINAWA_CODE ? 'selected' : ''}`}
        d={geometryToPath(feature.geometry, projection)}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
        tabIndex={0}
        role="button"
        aria-label={`${view.master.nameJa}: ${STATUS_LABELS[status]}`}
        onClick={() => handleShapeClick(OKINAWA_CODE)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') onSelect(OKINAWA_CODE);
        }}
      />
    </g>
  );
}

export const STATUS_PATTERN_LABELS: Record<PrefectureVisitStatus, string> = {
  unvisited: '薄い背景',
  passed: '斜線',
  landed: '点',
  visited: '塗り',
  stayed: '濃い塗り',
  lived: '紫の塗り',
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

function measurePinch(svg: SVGSVGElement, pointers: Map<number, { x: number; y: number }>) {
  const [first, second] = Array.from(pointers.values());
  if (!first || !second) return undefined;
  const firstPoint = svgPointFromClient(svg, first.x, first.y);
  const secondPoint = svgPointFromClient(svg, second.x, second.y);
  return {
    distance: Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y),
    centerX: (firstPoint.x + secondPoint.x) / 2,
    centerY: (firstPoint.y + secondPoint.y) / 2,
  };
}

function createPinchStart(
  svg: SVGSVGElement,
  pointers: Map<number, { x: number; y: number }>,
  viewport: { scale: number; x: number; y: number },
) {
  const pinch = measurePinch(svg, pointers);
  if (!pinch) return undefined;
  return {
    ...pinch,
    scale: viewport.scale,
    viewportX: viewport.x,
    viewportY: viewport.y,
  };
}
