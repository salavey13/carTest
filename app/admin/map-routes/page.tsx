'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';

export default function AdminMapRoutesPage() {
  const { dbUser } = useAppContext();
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('Road-snapped route');
  const [color, setColor] = useState('#4D99FF');
  const [type, setType] = useState<'path' | 'loop'>('path');
  const [geojson, setGeojson] = useState('');
  const [message, setMessage] = useState('');

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

  async function save() {
    if (!dbUser?.user_id) {
      setMessage('Авторизуйся в Telegram как admin/vprAdmin, чтобы сохранять маршруты');
      return;
    }
    setMessage('Saving...');
    const response = await fetch('/api/maps/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: dbUser.user_id, name, color, type, geojson }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      setMessage(result.error || 'Failed to save route');
      return;
    }

    setMessage('Route saved');
    setGeojson('');
    await load();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Map Routes Admin</CardTitle>
          <CardDescription>Create GeoJSON routes and push them into public.maps through server actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Actor from AppContext</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={dbUser?.user_id ? 'default' : 'secondary'}>
                {dbUser?.user_id ? 'Authenticated' : 'Not authenticated'}
              </Badge>
              <span className="text-sm text-muted-foreground">{dbUser?.user_id || 'No dbUser yet'}</span>
            </div>
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
            <Textarea rows={10} value={geojson} onChange={(event) => setGeojson(event.target.value)} placeholder='{"type":"Feature","geometry":{"type":"LineString","coordinates":[[44.01,56.33],[44.00,56.32]]}}' />
          </div>
          <Button onClick={save}>Save route to maps</Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing public routes</CardTitle>
          <CardDescription>{loading ? 'Loading…' : `${routes.length} routes`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {routes.map((route) => (
            <div key={route.id} className="rounded-xl border p-3 text-sm">
              <div className="font-medium">{route.name}</div>
              <div className="text-muted-foreground">{route.type} • {route.color}</div>
            </div>
          ))}
          {!routes.length ? <div className="text-sm text-muted-foreground">No routes yet.</div> : null}
        </CardContent>
      </Card>
    </main>
  );
}
