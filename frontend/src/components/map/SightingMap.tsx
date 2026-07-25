import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Sighting } from '../../types';

// Fix Leaflet marker icon default asset paths once
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Pre-cached Leaflet DivIcons to prevent recreating icons on every frame
const ICON_KNOWN = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 bg-emerald-600 border-white text-white shadow-md flex items-center justify-center font-bold text-xs">📍</div>`,
  className: 'custom-sighting-marker-known',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const ICON_REVIEW = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 bg-rose-600 border-white text-white shadow-md flex items-center justify-center font-bold text-xs">📍</div>`,
  className: 'custom-sighting-marker-review',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const ICON_RECURRING = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 bg-amber-600 border-white text-white shadow-md flex items-center justify-center font-bold text-xs">📍</div>`,
  className: 'custom-sighting-marker-recurring',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const ICON_UNKNOWN = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 bg-slate-900 border-white text-white shadow-md flex items-center justify-center font-bold text-xs">📍</div>`,
  className: 'custom-sighting-marker-unknown',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const getCustomIcon = (identityType: 'KNOWN' | 'UNKNOWN', status?: string) => {
  if (identityType === 'KNOWN') return ICON_KNOWN;
  if (status === 'REVIEW_REQUIRED') return ICON_REVIEW;
  if (status === 'RECURRING') return ICON_RECURRING;
  return ICON_UNKNOWN;
};

const getSnapshotUrl = (pathStr?: string) => {
  if (!pathStr) return '';
  const normalized = pathStr.replace(/\\/g, '/');
  if (normalized.startsWith('http')) return normalized;
  return `/${normalized}`;
};

// React-Leaflet Map Controller helper to update view without re-mounting MapContainer
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

interface SightingMapProps {
  sightings: Sighting[];
  onSelectSighting?: (sighting: Sighting) => void;
  showSequenceLine?: boolean;
  height?: string;
}

export const SightingMap: React.FC<SightingMapProps> = ({
  sightings,
  onSelectSighting,
  showSequenceLine = true,
  height = '500px',
}) => {
  // Filter valid coordinates
  const validSightings = useMemo(() => {
    return (sightings || []).filter(
      (s) =>
        s &&
        s.location &&
        typeof s.location.latitude === 'number' &&
        typeof s.location.longitude === 'number' &&
        !isNaN(s.location.latitude) &&
        !isNaN(s.location.longitude) &&
        (s.location.latitude !== 0 || s.location.longitude !== 0)
    );
  }, [sightings]);

  // Compute map center
  const mapCenter: [number, number] = useMemo(() => {
    if (validSightings.length === 0) return [12.9141, 74.856];
    const avgLat =
      validSightings.reduce((sum, s) => sum + s.location.latitude, 0) /
      validSightings.length;
    const avgLng =
      validSightings.reduce((sum, s) => sum + s.location.longitude, 0) /
      validSightings.length;
    return [avgLat, avgLng];
  }, [validSightings]);

  // Sort sightings chronologically for sequence polyline
  const sortedSightings = useMemo(() => {
    return [...validSightings].sort(
      (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
    );
  }, [validSightings]);

  const polylinePositions: [number, number][] = useMemo(() => {
    return sortedSightings.map((s) => [s.location.latitude, s.location.longitude]);
  }, [sortedSightings]);

  const mapTileUrl =
    import.meta.env.VITE_MAP_TILE_URL ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
      <MapContainer
        center={[12.9141, 74.856]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={mapTileUrl}
        />
        <MapController center={mapCenter} />

        {/* Observed Sighting Sequence Polyline */}
        {showSequenceLine && polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#0f172a',
              weight: 2.5,
              dashArray: '6, 6',
              opacity: 0.8,
            }}
          />
        )}

        {/* Sightings Markers */}
        {validSightings.map((sighting) => {
          const pos: [number, number] = [sighting.location.latitude, sighting.location.longitude];
          const icon = getCustomIcon(
            sighting.identityType,
            sighting.unknownPersonId?.status
          );

          const identityLabel =
            sighting.identityType === 'KNOWN'
              ? sighting.personId?.missingPersonName || 'Registered Person'
              : sighting.unknownPersonId?.unknownId || 'Unknown Person';

          return (
            <Marker key={sighting._id} position={pos} icon={icon}>
              <Popup className="sighting-popup">
                <div className="p-1 max-w-xs space-y-2 select-none text-slate-800">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b pb-1.5 gap-2">
                    <span className="font-bold text-xs truncate font-mono">
                      {identityLabel}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                        sighting.identityType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-900'
                      }`}
                    >
                      {sighting.identityType}
                    </span>
                  </div>

                  {/* Snapshot Preview */}
                  {sighting.snapshotObjectKey && (
                    <img
                      src={getSnapshotUrl(sighting.snapshotObjectKey)}
                      alt="Detection Snapshot"
                      className="w-full h-28 rounded-lg object-cover border border-slate-200 shadow-sm"
                    />
                  )}

                  {/* Location & Time */}
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-900 flex items-center gap-1">
                      📍 {sighting.location.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {new Date(sighting.detectedAt).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Match: {Math.round(sighting.similarity * 100)}%</span>
                      <span>
                        {sighting.sourceType === 'LIVE_CCTV'
                          ? `Camera: ${sighting.cameraId?.name || 'CCTV'}`
                          : `Video: ${sighting.videoId?.originalName || 'Upload'}`}
                      </span>
                    </div>
                  </div>

                  {/* View Details Action */}
                  {onSelectSighting && (
                    <button
                      type="button"
                      onClick={() => onSelectSighting(sighting)}
                      className="w-full py-1.5 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors mt-1"
                    >
                      View Details & Evidence
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Sequence Note Disclaimer */}
      {showSequenceLine && polylinePositions.length > 1 && (
        <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow border border-slate-700">
          Dashed Line: Observed Sighting Sequence
        </div>
      )}
    </div>
  );
};
