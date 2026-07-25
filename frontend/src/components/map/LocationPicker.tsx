import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

// Fix Vite Leaflet marker icon asset paths once
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

const DEFAULT_CENTER: [number, number] = [12.9141, 74.856];

// Helper to update map view without re-mounting MapContainer
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

interface LocationPickerProps {
  locationName: string;
  latitude: number;
  longitude: number;
  onChange: (data: { name: string; latitude: number; longitude: number }) => void;
  height?: string;
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  locationName,
  latitude,
  longitude,
  onChange,
  height = '280px',
}) => {
  const [name, setName] = useState(locationName || '');
  const [lat, setLat] = useState<number>(latitude || DEFAULT_CENTER[0]);
  const [lng, setLng] = useState<number>(longitude || DEFAULT_CENTER[1]);

  // Sync external props ONLY if genuinely changed from current internal state
  useEffect(() => {
    if (locationName !== undefined && locationName !== name) {
      setName(locationName);
    }
  }, [locationName]);

  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) {
      if (Math.abs(latitude - lat) > 0.00001 || Math.abs(longitude - lng) > 0.00001) {
        setLat(latitude || DEFAULT_CENTER[0]);
        setLng(longitude || DEFAULT_CENTER[1]);
      }
    }
  }, [latitude, longitude]);

  const handleMapClick = useCallback((newLat: number, newLng: number) => {
    const roundedLat = parseFloat(newLat.toFixed(6));
    const roundedLng = parseFloat(newLng.toFixed(6));
    setLat(roundedLat);
    setLng(roundedLng);
    onChange({ name, latitude: roundedLat, longitude: roundedLng });
  }, [name, onChange]);

  const handleNameChange = useCallback((val: string) => {
    setName(val);
    onChange({ name: val, latitude: lat, longitude: lng });
  }, [lat, lng, onChange]);

  const mapTileUrl =
    import.meta.env.VITE_MAP_TILE_URL ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const markerPosition: [number, number] = [lat || DEFAULT_CENTER[0], lng || DEFAULT_CENTER[1]];

  return (
    <div className="space-y-3">
      {/* Location Name Input */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Location Name / Landmark
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Main Gate, Railway Station Entrance, Bus Stand..."
          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
      </div>

      {/* Map Picker */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm" style={{ height }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url={mapTileUrl}
          />
          <MapController center={markerPosition} />
          <MapClickHandler onSelect={handleMapClick} />
          <Marker
            position={markerPosition}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                handleMapClick(pos.lat, pos.lng);
              },
            }}
          />
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-mono px-3 py-1.5 rounded-lg shadow border border-slate-700 flex items-center gap-2">
          <MapPin className="h-3 w-3 text-rose-400" />
          <span>
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
          <span className="text-slate-400 font-sans text-[9px] ml-1">(Click map to move)</span>
        </div>
      </div>

      {/* Lat/Lng Manual Inputs */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => handleMapClick(parseFloat(e.target.value) || 0, lng)}
            className="w-full text-xs font-mono p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => handleMapClick(lat, parseFloat(e.target.value) || 0)}
            className="w-full text-xs font-mono p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>
    </div>
  );
};
