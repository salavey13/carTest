'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';

type AdminRoute = {
  mapId: string;
  mapName: string;
  routeId: string;
  name: string;
  type: 'path' | 'loop';
  color: string;
  hasGeojson: boolean;
  coordCount: number;
};

export default function AdminMapRoutesPage() {
  const { dbUser } = useAppContext();
  const [routes, setRoutes] = useState<AdminRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('Road-snapped route');
  const [color, setColor] = useState('#4D99FF');
  const [type, setType] = useState<'path' | 'loop'>('path');
  const [geojson, setGeojson] = useState('');
  const [baseWaypoints, setBaseWaypoints] = useState('[[56.29659,43.93606],[56.31974,43.93398],[56.3267,44.0075],[56.3149,43.9475],[56.2475,43.8702],[56.2157,43.8169]]');
  const [editingRoute, setEditingRoute] = useState<AdminRoute | null>(null);
  const [message, setMessage] = useState('');
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

  const routeCountText = useMemo(() => (loading ? 'Loading…' : `${routes.length} routes`), [loading, routes.length]);

  async function save() {
    if (!dbUser?.user_id) {
      setMessage('Авторизуйся в Telegram как admin/vprAdmin, чтобы сохранять маршруты');
      return;
    }
    setMessage(editingRoute ? 'Updating...' : 'Saving...');
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
      setMessage(result.error || 'Failed to save route');
      return;
    }

    setMessage(editingRoute ? 'Route updated' : 'Route saved');
    setGeojson('');
    setEditingRoute(null);
    await load();
  }

  async function removeRoute(route: AdminRoute) {
    if (!dbUser?.user_id) {
      setMessage('Нужна авторизация admin/vprAdmin');
      return;
    }
    setMessage(`Deleting ${route.name}...`);
    const response = await fetch('/api/maps/routes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: dbUser.user_id, mapId: route.mapId, routeId: route.routeId }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setMessage(result.error || 'Failed to delete route');
      return;
    }
    setMessage(`Route "${route.name}" deleted`);
    if (editingRoute?.routeId === route.routeId) setEditingRoute(null);
    await load();
  }

  async function generateRoadGeo() {
    setMessage('Generating road-snapped GeoJSON...');
    try {
      const waypoints = JSON.parse(baseWaypoints);
      const response = await fetch('/api/maps/routes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Generation failed');
      setGeojson(JSON.stringify(result.data, null, 2));
      setMessage('Road-snapped GeoJSON generated. Проверь и сохрани.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to generate road GeoJSON');
    }
  }

  function loadRouteIntoEditor(route: AdminRoute) {
    setEditingRoute(route);
    setName(route.name);
    setColor(route.color);
    setType(route.type);
    setMessage(`Editing: ${route.name}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Map Routes Admin</CardTitle>
          <CardDescription>Создание, редактирование и удаление маршрутов в public.maps.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Как делать красивые маршруты (RU)</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Собери базовые точки <span className="font-mono">[lat, lon]</span> из Google/2GIS (перекрёстки, мосты, видовые точки).</li>
              <li>Вставь их в блок “Базовые точки” и нажми <span className="font-medium">Generate road GeoJSON</span>.</li>
              <li>Сервер дернет роутинг-API (OSRM), вернёт дорожный LineString и подставит в поле GeoJSON.</li>
              <li>Сохрани маршрут. Он попадёт в Supabase <span className="font-mono">public.maps</span> и сразу отрисуется в Leaflet.</li>
            </ol>
          </div>

          <div className="grid gap-2">
            <Label>Базовые точки [lat, lon] для road-snap</Label>
            <Textarea rows={4} value={baseWaypoints} onChange={(event) => setBaseWaypoints(event.target.value)} />
            <Button type="button" variant="outline" onClick={generateRoadGeo}>Generate road GeoJSON</Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Route name</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Color</Label>
              <Input value={color} onChange={(event) => setColor(event.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <select className="rounded-md border bg-background px-3 py-2" value={type} onChange={(event) => setType(event.target.value as 'path' | 'loop')}>
                <option value="path">path</option>
                <option value="loop">loop</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>GeoJSON Feature / FeatureCollection</Label>
            <Textarea rows={12} value={geojson} onChange={(event) => setGeojson(event.target.value)} placeholder='{"type":"Feature","geometry":{"type":"LineString","coordinates":[[44.01,56.33],[44.00,56.32]]}}' />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!canMutate}>{editingRoute ? 'Update route' : 'Save route to maps'}</Button>
            {editingRoute ? (
              <Button type="button" variant="outline" onClick={() => setEditingRoute(null)}>Cancel edit</Button>
            ) : null}
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing public routes</CardTitle>
          <CardDescription>{routeCountText}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {routes.map((route) => (
            <div key={`${route.mapId}:${route.routeId}`} className="rounded-xl border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{route.name}</div>
                  <div className="text-muted-foreground">{route.type} • {route.color} • {route.mapName}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={route.hasGeojson ? 'default' : 'secondary'}>{route.hasGeojson ? 'GeoJSON' : 'coords only'}</Badge>
                  <Badge variant="outline">{route.coordCount} pts</Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => loadRouteIntoEditor(route)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => removeRoute(route)} disabled={!canMutate}>Delete</Button>
              </div>
            </div>
          ))}
          {!routes.length ? <div className="text-sm text-muted-foreground">No routes yet.</div> : null}
        </CardContent>
      </Card>
    </main>
  );
}
