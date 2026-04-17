'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import dynamic from 'next/dynamic';
import type { PointOfInterest } from '@/lib/map-utils';

const RacingMap = dynamic(() => import('@/components/maps/RacingMap').then((mod) => mod.RacingMap), { ssr: false });

type AdminRoute = {
  mapId: string;
  mapName: string;
  routeId: string;
  name: string;
  type: 'path' | 'loop';
  color: string;
  hasGeojson: boolean;
  coordCount: number;
  coords: [number, number][];
  geojson: unknown | null;
};

const DEFAULT_BOUNDS = { top: 56.42, bottom: 56.08, left: 43.66, right: 44.12 };

function toNumericWaypoints(points: Array<{ lat: string; lon: string }>): Array<[number, number]> {
  return points
    .map((entry) => [Number(entry.lat), Number(entry.lon)] as [number, number])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
}

function parseWaypoints(raw: string): Array<{ lat: string; lon: string }> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => Array.isArray(entry) && entry.length >= 2)
      .map((entry) => ({ lat: String(entry[0] ?? ''), lon: String(entry[1] ?? '') }));
  } catch {
    return [];
  }
}

function uniquePush(target: Array<[number, number]>, next: [number, number], tolerance = 0.00003) {
  const prev = target[target.length - 1];
  if (!prev) {
    target.push(next);
    return;
  }
  const same = Math.abs(prev[0] - next[0]) <= tolerance && Math.abs(prev[1] - next[1]) <= tolerance;
  if (!same) target.push(next);
}

function geojsonToCoords(value: unknown): Array<[number, number]> {
  if (!value || typeof value !== 'object') return [];
  const result: Array<[number, number]> = [];

  const walkCoordinates = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      uniquePush(result, [Number(coords[1]), Number(coords[0])]);
      return;
    }
    coords.forEach((entry) => walkCoordinates(entry));
  };

  const maybeFeature = value as { type?: string; geometry?: { coordinates?: unknown }; features?: Array<{ geometry?: { coordinates?: unknown } }> };
  if (maybeFeature.type === 'Feature' && maybeFeature.geometry?.coordinates) {
    walkCoordinates(maybeFeature.geometry.coordinates);
  }
  if (maybeFeature.type === 'FeatureCollection' && Array.isArray(maybeFeature.features)) {
    maybeFeature.features.forEach((feature) => walkCoordinates(feature.geometry?.coordinates));
  }

  return result;
}

function trimSuffixBySegment(
  source: Array<[number, number]>,
  suffix: Array<[number, number]>,
  tolerance = 0.0001,
): Array<[number, number]> {
  if (!source.length || !suffix.length || source.length <= suffix.length) return source;
  const start = source.length - suffix.length;
  const matches = suffix.every((point, index) => {
    const candidate = source[start + index];
    return (
      Math.abs(candidate[0] - point[0]) <= tolerance && Math.abs(candidate[1] - point[1]) <= tolerance
    );
  });
  if (!matches) return source;
  return source.slice(0, start);
}

function mergeSegments(...segments: Array<Array<[number, number]>>): Array<[number, number]> {
  const merged: Array<[number, number]> = [];
  for (const segment of segments) {
    for (const point of segment) uniquePush(merged, point);
  }
  return merged;
}

async function generateRoadSegment(waypoints: Array<[number, number]>): Promise<Array<[number, number]>> {
  if (waypoints.length < 2) return [];
  const response = await fetch('/api/maps/routes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ waypoints }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Не удалось построить дорожный сегмент');
  }
  return geojsonToCoords(result.data);
}

function lineStringGeoJson(coords: Array<[number, number]>) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coords.map(([lat, lon]) => [lon, lat]),
    },
    properties: {
      source: 'map-routes-admin',
      generatedAt: new Date().toISOString(),
    },
  };
}


function parseGeojsonSafe(raw: string): unknown | null {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export default function AdminMapRoutesPage() {
  const { dbUser } = useAppContext();
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('Маршрут по дорогам');
  const [color, setColor] = useState('#4D99FF');
  const [type, setType] = useState<'path' | 'loop'>('path');
  const [geojson, setGeojson] = useState('');
  const [baseWaypoints, setBaseWaypoints] = useState('[[56.29659,43.93606],[56.31974,43.93398],[56.3267,44.0075],[56.3149,43.9475],[56.2475,43.8702],[56.2157,43.8169]]');
  const [manualWaypoints, setManualWaypoints] = useState<Array<{ lat: string; lon: string }>>([]);
  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
  const [message, setMessage] = useState('');
  const [isAppendingByMap, setIsAppendingByMap] = useState(false);
  const [selectedMapPoint, setSelectedMapPoint] = useState<[number, number] | null>(null);
  const canMutate = Boolean(dbUser?.user_id);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/maps/routes', { cache: 'no-store' });
    const result = await response.json();
    if (result.success) setRoutes(result.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const routeCountText = useMemo(() => (loading ? 'Загрузка…' : `${routes.length} маршрутов`), [loading, routes.length]);

  function syncTextFromManual(nextWaypoints: Array<{ lat: string; lon: string }>) {
    const numericWaypoints = toNumericWaypoints(nextWaypoints);
    setBaseWaypoints(JSON.stringify(numericWaypoints));
  }

  useEffect(() => {
    setManualWaypoints(parseWaypoints(baseWaypoints));
  }, [baseWaypoints]);

  async function save() {
    if (!dbUser?.user_id) {
      setMessage('Авторизуйся в Telegram как admin/vprAdmin, чтобы сохранять маршруты.');
      return;
    }
    setMessage(editingRoute ? 'Обновляю маршрут…' : 'Сохраняю маршрут…');
    const endpoint = '/api/maps/routes';
    const method = editingRoute ? 'PUT' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: dbUser.user_id,
        mapId: editingRoute?.mapId,
        routeId: editingRoute?.routeId,
        name,
        color,
        type,
        geojson,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      setMessage(result.error || 'Не удалось сохранить маршрут.');
      return;
    }

    setMessage(editingRoute ? 'Маршрут обновлён.' : 'Маршрут сохранён.');
    setGeojson('');
    setEditingRoute(null);
    await load();
  }

  async function removeRoute(route: AdminRoute) {
    if (!dbUser?.user_id) {
      setMessage('Нужна авторизация admin/vprAdmin.');
      return;
    }
    setMessage(`Удаляю маршрут «${route.name}»…`);
    const response = await fetch('/api/maps/routes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: dbUser.user_id, mapId: route.mapId, routeId: route.routeId }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setMessage(result.error || 'Не удалось удалить маршрут.');
      return;
    }
    setMessage(`Маршрут «${route.name}» удалён.`);
    if (editingRoute?.routeId === route.routeId) setEditingRoute(null);
    await load();
  }

  async function generateRoadGeo() {
    setMessage('Строю дорожный GeoJSON через OSRM…');
    try {
      const waypoints = JSON.parse(baseWaypoints);
      const response = await fetch('/api/maps/routes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Ошибка генерации');
      setGeojson(JSON.stringify(result.data, null, 2));
      setMessage('Готово: дорожный GeoJSON обновлён. Проверь и сохрани маршрут.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось построить GeoJSON.');
    }
  }

  async function appendLastPointByMap(nextPoint: [number, number]) {
    const numericWaypoints = toNumericWaypoints(manualWaypoints);
    if (numericWaypoints.length === 0) {
      setMessage('Сначала добавь минимум одну базовую точку, затем используй «+» на карте.');
      return;
    }

    setIsAppendingByMap(true);
    setMessage('Добавляю точку с карты и пересчитываю хвост маршрута…');
    try {
      const first = numericWaypoints[0];
      const prevLast = numericWaypoints[numericWaypoints.length - 1];
      const expandedWaypoints = [...numericWaypoints, nextPoint];
      setManualWaypoints(expandedWaypoints.map(([lat, lon]) => ({ lat: String(lat), lon: String(lon) })));
      syncTextFromManual(expandedWaypoints.map(([lat, lon]) => ({ lat: String(lat), lon: String(lon) })));

      const currentCoords = geojsonToCoords(parseGeojsonSafe(geojson));
      let nextCoords: Array<[number, number]>;

      if (type === 'loop' && expandedWaypoints.length >= 3) {
        const oldClosure = await generateRoadSegment([prevLast, first]);
        const tailToNew = await generateRoadSegment([prevLast, nextPoint]);
        const newClosure = await generateRoadSegment([nextPoint, first]);
        const trimmed = currentCoords.length ? trimSuffixBySegment(currentCoords, oldClosure) : await generateRoadSegment(numericWaypoints);
        nextCoords = mergeSegments(trimmed, tailToNew, newClosure);
      } else {
        const tailToNew = await generateRoadSegment([prevLast, nextPoint]);
        const source = currentCoords.length ? currentCoords : await generateRoadSegment(numericWaypoints);
        nextCoords = mergeSegments(source, tailToNew);
      }

      setGeojson(JSON.stringify(lineStringGeoJson(nextCoords), null, 2));
      setMessage('Точка добавлена с карты: хвост маршрута обновлён динамически.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось динамически добавить точку.');
    } finally {
      setIsAppendingByMap(false);
    }
  }

  function updateManualWaypoint(index: number, key: 'lat' | 'lon', value: string) {
    setManualWaypoints((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      syncTextFromManual(next);
      return next;
    });
  }

  function addManualWaypoint() {
    setManualWaypoints((prev) => {
      const next = [...prev, { lat: '', lon: '' }];
      syncTextFromManual(next);
      return next;
    });
  }

  function removeManualWaypoint(index: number) {
    setManualWaypoints((prev) => {
      const next = prev.filter((_, currentIndex) => currentIndex !== index);
      syncTextFromManual(next);
      return next;
    });
  }

  function loadRouteIntoEditor(route: AdminRoute) {
    setEditingRoute(route);
    setName(route.name);
    setColor(route.color);
    setType(route.type);
    const coordsFromRoute = route.coords.length ? route.coords : geojsonToCoords(route.geojson);
    if (coordsFromRoute.length) {
      setBaseWaypoints(JSON.stringify(coordsFromRoute));
      setManualWaypoints(coordsFromRoute.map(([lat, lon]) => ({ lat: String(lat), lon: String(lon) })));
    }
    if (route.geojson) {
      setGeojson(JSON.stringify(route.geojson, null, 2));
    }
    setMessage(`Редактирование: ${route.name}`);
  }

  const mapPoints = useMemo<PointOfInterest[]>(() => {
    const base = routes.map((route) => ({
      id: `route-${route.mapId}-${route.routeId}`,
      name: route.name,
      type: route.type,
      icon: '::FaRoute::',
      color: route.color,
      coords: route.coords,
      geojson: route.geojson || undefined,
      roadHighlight: {
        glow: true,
        weight: editingRoute?.routeId === route.routeId ? 7 : 5,
      },
    })) as PointOfInterest[];

    const draftCoords = geojsonToCoords(parseGeojsonSafe(geojson));
    if (!draftCoords.length) return base;

    return [
      ...base,
      {
        id: 'draft-route-preview',
        name: editingRoute ? `Черновик: ${editingRoute.name}` : 'Черновик нового маршрута',
        type,
        icon: '::FaRoute::',
        color,
        coords: draftCoords,
        geojson: lineStringGeoJson(draftCoords),
        roadHighlight: { glow: true, weight: 8, animated: true },
      },
    ] as PointOfInterest[];
  }, [routes, editingRoute, geojson, type, color]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Админка маршрутов карты</CardTitle>
          <CardDescription>Создание, доработка и удаление маршрутов в public.maps.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Как проще всего собирать красивые маршруты</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Добавь базовые точки вручную или кликами через «+» на карте (внизу страницы).</li>
              <li>Нажми «Построить дорожный GeoJSON», чтобы сервер проложил линию по дорогам (OSRM).</li>
              <li>Если точка добавлена последней — используй динамическое добавление хвоста, без полной перестройки.</li>
              <li>Для <span className="font-mono">loop</span> автоматически обновляется замыкание: старый хвост к старту снимается, новый строится от новой точки.</li>
              <li>Сохрани маршрут — он сразу появится в списке и на карте.</li>
            </ol>
          </div>

          <div className="grid gap-2">
            <Label>Базовые точки [lat, lon] для road-snap</Label>
            <Textarea
              rows={4}
              value={baseWaypoints}
              onChange={(event) => {
                const value = event.target.value;
                setBaseWaypoints(value);
                setManualWaypoints(parseWaypoints(value));
              }}
            />
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Ручной список точек</span>
                <Button type="button" size="sm" variant="outline" onClick={addManualWaypoint}>+ добавить точку</Button>
              </div>
              <div className="space-y-2">
                {manualWaypoints.map((point, index) => (
                  <div key={`${index}-${point.lat}-${point.lon}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      value={point.lat}
                      placeholder="широта (lat)"
                      onChange={(event) => updateManualWaypoint(index, 'lat', event.target.value)}
                    />
                    <Input
                      value={point.lon}
                      placeholder="долгота (lon)"
                      onChange={(event) => updateManualWaypoint(index, 'lon', event.target.value)}
                    />
                    <Button type="button" size="icon" variant="outline" onClick={() => removeManualWaypoint(index)} aria-label={`remove-point-${index}`}>
                      −
                    </Button>
                  </div>
                ))}
                {!manualWaypoints.length ? <div className="text-xs text-muted-foreground">Добавь точки кнопкой «+ добавить точку» или вставь JSON выше.</div> : null}
              </div>
            </div>
            <Button type="button" variant="outline" onClick={generateRoadGeo}>Построить дорожный GeoJSON</Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Название маршрута</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Цвет</Label>
              <Input value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Тип</Label>
              <select className="rounded-md border bg-background px-3 py-2" value={type} onChange={(event) => setType(event.target.value as 'path' | 'loop')}>
                <option value="path">path (линейный)</option>
                <option value="loop">loop (замкнутый)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>GeoJSON (Feature или FeatureCollection)</Label>
            <Textarea rows={12} value={geojson} onChange={(event) => setGeojson(event.target.value)} placeholder='{"type":"Feature","geometry":{"type":"LineString","coordinates":[[44.01,56.33],[44.00,56.32]]}}' />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!canMutate}>{editingRoute ? 'Обновить маршрут' : 'Сохранить маршрут'}</Button>
            {editingRoute ? (
              <Button type="button" variant="outline" onClick={() => setEditingRoute(null)}>Отменить редактирование</Button>
            ) : null}
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Существующие публичные маршруты</CardTitle>
          <CardDescription>{routeCountText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {routes.map((route) => (
            <div key={`${route.mapId}:${route.routeId}`} className={`rounded-xl border p-3 text-sm ${editingRoute?.routeId === route.routeId ? 'border-primary' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{route.name}</div>
                  <div className="text-muted-foreground">{route.type} • {route.color} • {route.mapName}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={route.hasGeojson ? 'default' : 'secondary'}>{route.hasGeojson ? 'GeoJSON' : 'только coords'}</Badge>
                  <Badge variant="outline">{route.coordCount} точек</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => loadRouteIntoEditor(route)}>Выбрать и редактировать</Button>
                <Button size="sm" variant="destructive" onClick={() => removeRoute(route)} disabled={!canMutate}>Удалить</Button>
              </div>
            </div>
          ))}
          {!routes.length ? <div className="text-sm text-muted-foreground">Маршрутов пока нет.</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Карта маршрутов (снизу для быстрой правки)</CardTitle>
          <CardDescription>
            Кликни по карте, затем нажми «+» — точка добавится в конец и хвост маршрута обновится без полной перестройки.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
            <span className="text-muted-foreground">
              {selectedMapPoint
                ? `Выбрана точка: ${selectedMapPoint[0].toFixed(5)}, ${selectedMapPoint[1].toFixed(5)}`
                : 'Точка не выбрана — тапни по карте.'}
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7 min-w-7 rounded-full px-2"
              disabled={!selectedMapPoint || isAppendingByMap}
              onClick={() => selectedMapPoint && appendLastPointByMap(selectedMapPoint)}
              aria-label="Добавить выбранную точку в конец маршрута"
            >
              {isAppendingByMap ? '…' : '+'}
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 overflow-hidden">
            <RacingMap
              points={mapPoints}
              bounds={DEFAULT_BOUNDS}
              tileLayer="cartodb-dark"
              className="h-[52vh] min-h-[360px] w-full"
              onMapClick={setSelectedMapPoint}
              onMapLongPress={setSelectedMapPoint}
              onPointClick={(poi) => {
                const route = routes.find((item) => `route-${item.mapId}-${item.routeId}` === poi.id);
                if (route) loadRouteIntoEditor(route);
              }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {isAppendingByMap ? '⏳ Добавляю точку в конец маршрута…' : 'Совет: сначала выбери маршрут выше, потом добавляй новые точки прямо с карты.'}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
