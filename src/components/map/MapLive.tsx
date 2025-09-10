// src/components/map/MapLive.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// --- ICON FIX (required for many bundlers) ---
/* If your bundler doesn't like require(...) for images, see the note below */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});
// ------------------------------------------------

type LatLng = { lat: number; lng: number };

// Child component to recenter map when follow=true
const RecenterWhenFollowing: React.FC<{ position: LatLng | null; follow: boolean }> = ({ position, follow }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !position || !follow) return;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [map, position, follow]);
  return null;
};

const PH_CENTER: LatLng = { lat: 12.8797, lng: 121.7740 };

export default function MapLive({ height = '60vh' }: { height?: string }) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'watching' | 'error' | 'unsupported'>('idle');
  const [follow, setFollow] = useState<boolean>(true);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }

    // Start watching
    setStatus('watching');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setStatus('watching');
      },
      (err) => {
        console.error('geolocation error', err);
        setStatus('error');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const startWatch = () => {
    if (!('geolocation' in navigator)) { setStatus('unsupported'); return; }
    if (watchIdRef.current !== null) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy ?? null);
        setStatus('watching');
      },
      (err) => { console.error('geolocation error', err); setStatus('error'); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchIdRef.current = id;
  };

  const stopWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('idle');
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-lg border relative" style={{ height }}>
      <MapContainer center={[PH_CENTER.lat, PH_CENTER.lng]} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {position && (
          <>
            <Marker position={[position.lat, position.lng]} />
            {accuracy !== null && <Circle center={[position.lat, position.lng]} radius={accuracy} pathOptions={{ opacity: 0.2 }} />}
          </>
        )}

        <RecenterWhenFollowing position={position} follow={follow} />
      </MapContainer>

      <div className="absolute top-3 right-3 bg-white bg-opacity-95 p-2 rounded-md shadow-md text-xs z-20">
        <div className="flex items-center gap-2">
          <button onClick={() => setFollow((f) => !f)} className="px-2 py-1 rounded-md border text-sm">
            {follow ? 'Following ✓' : 'Follow: off'}
          </button>

          {status === 'watching' ? (
            <button onClick={stopWatch} className="px-2 py-1 rounded-md border text-sm">Stop</button>
          ) : (
            <button onClick={startWatch} className="px-2 py-1 rounded-md border text-sm">Start</button>
          )}
        </div>

        <div className="mt-2">
          {status === 'unsupported' && <div className="text-red-600">Geolocation not supported in this browser.</div>}
          {status === 'error' && <div className="text-red-600">Unable to get location. Check permissions.</div>}
          {status === 'idle' && <div className="text-gray-600">Location paused.</div>}
          {status === 'watching' && position && (
            <div className="text-gray-700">
              <div>Lat {position.lat.toFixed(5)}, Lon {position.lng.toFixed(5)}</div>
              {accuracy !== null && <div className="text-gray-600">Accuracy ≈ {Math.round(accuracy)} m</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}