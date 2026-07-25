import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Camera } from '../../types';

// Fix Vite Leaflet default marker icons once
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Pre-cached Leaflet DivIcons for Cameras
const ICON_CAM_ONLINE = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 border-white bg-emerald-600 text-white shadow-md flex items-center justify-center font-bold text-xs">📷</div>`,
  className: 'custom-camera-marker-online',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const ICON_CAM_OFFLINE = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 border-white bg-slate-500 text-slate-200 shadow-md flex items-center justify-center font-bold text-xs">📷</div>`,
  className: 'custom-camera-marker-offline',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const ICON_CAM_MAINT = L.divIcon({
  html: `<div class="w-8 h-8 rounded-full border-2 border-white bg-amber-600 text-white shadow-md flex items-center justify-center font-bold text-xs">📷</div>`,
  className: 'custom-camera-marker-maint',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const getCameraIcon = (status: string) => {
  if (status === 'online') return ICON_CAM_ONLINE;
  if (status === 'maintenance') return ICON_CAM_MAINT;
  return ICON_CAM_OFFLINE;
};

// Map View Controller
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

interface CameraMapProps {
  cameras: Camera[];
  height?: string;
  onSelectCamera?: (camera: Camera) => void;
}

export const CameraMap: React.FC<CameraMapProps> = ({
  cameras,
  height = '500px',
  onSelectCamera,
}) => {
  const validCameras = useMemo(() => {
    return (cameras || []).filter((c) => {
      if (c && typeof c.location === 'object' && c.location) {
        return (
          typeof c.location.latitude === 'number' &&
          typeof c.location.longitude === 'number' &&
          !isNaN(c.location.latitude) &&
          !isNaN(c.location.longitude) &&
          (c.location.latitude !== 0 || c.location.longitude !== 0)
        );
      }
      return false;
    });
  }, [cameras]);

  const mapCenter: [number, number] = useMemo(() => {
    if (validCameras.length === 0) return [12.9141, 74.856];
    const avgLat =
      validCameras.reduce((sum, c) => sum + (c.location as any).latitude, 0) /
      validCameras.length;
    const avgLng =
      validCameras.reduce((sum, c) => sum + (c.location as any).longitude, 0) /
      validCameras.length;
    return [avgLat, avgLng];
  }, [validCameras]);

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

        {validCameras.map((camera) => {
          const loc = camera.location as any;
          const pos: [number, number] = [loc.latitude, loc.longitude];
          const icon = getCameraIcon(camera.status);

          return (
            <Marker key={camera._id} position={pos} icon={icon}>
              <Popup>
                <div className="p-1 max-w-xs space-y-1.5 select-none text-slate-800">
                  <div className="flex items-center justify-between border-b pb-1">
                    <span className="font-bold text-xs">{camera.name}</span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white ${
                        camera.status === 'online'
                          ? 'bg-emerald-600'
                          : camera.status === 'maintenance'
                          ? 'bg-amber-600'
                          : 'bg-slate-600'
                      }`}
                    >
                      {camera.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-semibold">
                    📍 {loc.name || 'Camera Location'}
                  </p>

                  <p className="text-[11px] text-slate-500 font-mono">
                    Coords: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </p>

                  {onSelectCamera && (
                    <button
                      type="button"
                      onClick={() => onSelectCamera(camera)}
                      className="w-full py-1 bg-slate-900 text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors mt-1"
                    >
                      View Camera Stream
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow border border-slate-700">
        Registered CCTV Camera Network ({validCameras.length} on map)
      </div>
    </div>
  );
};
