import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import * as api from '../../services/api';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface RouteMapProps {
  routeId: string;
  originStop: { stop_id: string; stop_name: string; stop_lat: string; stop_lon: string };
  destinationStop: { stop_id: string; stop_name: string; stop_lat: string; stop_lon: string };
  routeName: string;
}

interface ShapePoint {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
}

// Component to auto-fit map bounds to route
const AutoFitBounds: React.FC<{ coordinates: [number, number][] }> = ({ coordinates }) => {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coordinates, map]);

  return null;
};

interface TripSegment {
  trip_id: string;
  trip_headsign: string;
  shape_id: string;
  points: ShapePoint[];
}

const RouteMap: React.FC<RouteMapProps> = ({ routeId, originStop, destinationStop, routeName }) => {
  const [segments, setSegments] = useState<TripSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log the coordinates being used
  useEffect(() => {
    console.log('RouteMap - Origin Stop:', originStop.stop_name,
      'Coords:', originStop.stop_lat, originStop.stop_lon);
    console.log('RouteMap - Destination Stop:', destinationStop.stop_name,
      'Coords:', destinationStop.stop_lat, destinationStop.stop_lon);
  }, [originStop, destinationStop]);

  useEffect(() => {
    const fetchTripShapes = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch all trip segments between origin and destination
        const data = await api.getTripShapes(originStop.stop_id, destinationStop.stop_id);
        setSegments(data.segments || []);
      } catch (err) {
        // Silently fail - shape data is optional
        // The map will fall back to showing a direct line between origin and destination
        setSegments([]);
      } finally {
        setLoading(false);
      }
    };

    if (originStop.stop_id && destinationStop.stop_id) {
      fetchTripShapes();
    }
  }, [originStop.stop_id, destinationStop.stop_id]);

  // Convert segments to polyline data
  const hasSegments = segments.length > 0;

  // Collect all coordinates for auto-fit bounds
  const allCoordinates: [number, number][] = hasSegments
    ? segments.flatMap(seg =>
        seg.points
          .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
          .map(p => [p.shape_pt_lat, p.shape_pt_lon] as [number, number])
      )
    : [
        [parseFloat(originStop.stop_lat), parseFloat(originStop.stop_lon)] as [number, number],
        [parseFloat(destinationStop.stop_lat), parseFloat(destinationStop.stop_lon)] as [number, number]
      ];

  // Calculate center point
  const centerLat = (parseFloat(originStop.stop_lat) + parseFloat(destinationStop.stop_lat)) / 2;
  const centerLon = (parseFloat(originStop.stop_lon) + parseFloat(destinationStop.stop_lon)) / 2;

  // Custom markers for origin (green) and destination (red)
  const greenIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading route map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Showing direct route instead</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-96 rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-gray-600 relative">
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route paths - multiple segments with different colors */}
        {hasSegments ? (
          segments.map((segment, index) => {
            const coordinates = segment.points
              .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
              .map(p => [p.shape_pt_lat, p.shape_pt_lon] as [number, number]);

            // Color code: bright red for jeepney, bright blue for walking
            const isWalkingSegment = segment.trip_headsign?.toLowerCase().includes('walk');
            const color = isWalkingSegment ? '#2563EB' : '#EF4444'; // Blue-600 : Red-500
            const weight = isWalkingSegment ? 5 : 6;
            const dashArray = isWalkingSegment ? '8, 8' : undefined;

            return (
              <Polyline
                key={index}
                positions={coordinates}
                pathOptions={{
                  color,
                  weight,
                  opacity: 0.7,
                  dashArray
                }}
              />
            );
          })
        ) : (
          <Polyline
            positions={allCoordinates}
            pathOptions={{
              color: '#EAB308',
              weight: 5,
              opacity: 0.7
            }}
          />
        )}

        {/* Origin marker (green) */}
        <Marker
          position={[parseFloat(originStop.stop_lat), parseFloat(originStop.stop_lon)]}
          icon={greenIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong>Origin</strong><br />
              {originStop.stop_name}
            </div>
          </Popup>
        </Marker>

        {/* Destination marker (red) */}
        <Marker
          position={[parseFloat(destinationStop.stop_lat), parseFloat(destinationStop.stop_lon)]}
          icon={redIcon}
        >
          <Popup>
            <div className="text-sm">
              <strong>Destination</strong><br />
              {destinationStop.stop_name}
            </div>
          </Popup>
        </Marker>

        {/* Auto-fit bounds to show entire route */}
        <AutoFitBounds coordinates={allCoordinates} />
      </MapContainer>

      {/* Route info overlay */}
      <div className="absolute top-3 left-3 bg-white dark:bg-gray-800 bg-opacity-95 p-3 rounded-lg shadow-md z-[400] max-w-xs pointer-events-none">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-sm text-gray-800 dark:text-white">Multi-Modal Route</span>
          </div>
          {!hasSegments && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              ℹ️ Direct route shown
            </p>
          )}
          {hasSegments && (
            <div className="space-y-1">
              {segments.map((seg, i) => {
                const isWalk = seg.trip_headsign?.toLowerCase().includes('walk');
                // Extract just the relevant part after the colon
                const displayText = seg.trip_headsign?.includes(':')
                  ? seg.trip_headsign.split(':')[1].trim()
                  : seg.trip_headsign;

                return (
                  <div key={i} className="flex items-center space-x-2 text-xs">
                    <div className={`w-2 h-2 rounded-full ${isWalk ? 'bg-blue-600' : 'bg-red-500'}`}></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      {isWalk ? '🚶' : '🚐'} {displayText}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteMap;
