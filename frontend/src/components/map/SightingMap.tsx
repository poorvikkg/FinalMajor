import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Sighting } from '../../types';
import {
  calculatePersonPathPrediction,
  fetchOSRMRoute,
  getMultiLocationPathPredictions,
  getPersonKey,
  getSnapshotUrl,
} from '../../utils/pathPrediction';
import type { PersonPathPrediction } from '../../utils/pathPrediction';
import { Compass, Navigation } from 'lucide-react';

// Fix Leaflet marker icon default asset paths once
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Pre-cached Leaflet DivIcons
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

// Dynamic Step Sequence DivIcon (#1, #2, #3...)
const createStepIcon = (seqNumber: number, isKnown: boolean) => {
  const bgClass = isKnown ? 'bg-emerald-600' : 'bg-slate-900';
  return L.divIcon({
    html: `<div class="w-7 h-7 rounded-full border-2 border-white ${bgClass} text-white shadow-md flex items-center justify-center font-bold font-mono text-[11px]">#${seqNumber}</div>`,
    className: 'custom-sighting-marker-step',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// Target Icon for Predicted Location (+15m / +30m)
const createPredictedTargetIcon = (label: string) => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full bg-indigo-500/30 animate-ping"></div>
        <div class="relative w-8 h-8 rounded-full border-2 bg-slate-900 border-white text-white shadow-md flex items-center justify-center font-bold text-xs">
          🎯
        </div>
        <div class="absolute -bottom-5 whitespace-nowrap bg-slate-900 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm border border-slate-700">
          ${label}
        </div>
      </div>
    `,
    className: 'custom-sighting-marker-predicted',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

const getCustomIcon = (identityType: 'KNOWN' | 'UNKNOWN', status?: string) => {
  if (identityType === 'KNOWN') return ICON_KNOWN;
  if (status === 'REVIEW_REQUIRED') return ICON_REVIEW;
  if (status === 'RECURRING') return ICON_RECURRING;
  return ICON_UNKNOWN;
};

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
  showPredictivePath?: boolean;
  selectedPersonKey?: string;
  height?: string;
}

interface RoadRouteData {
  observedRoadCoords: [number, number][];
  predictedRoadCoords: [number, number][];
  summary?: string;
}

export const SightingMap: React.FC<SightingMapProps> = ({
  sightings,
  onSelectSighting,
  showSequenceLine = true,
  showPredictivePath = true,
  selectedPersonKey,
  height = '500px',
}) => {
  const [roadRoutesMap, setRoadRoutesMap] = useState<Map<string, RoadRouteData>>(new Map());

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

  // Compute map center safely
  const mapCenter: [number, number] = useMemo(() => {
    if (validSightings.length === 0) return [12.9141, 74.856];
    const avgLat =
      validSightings.reduce((sum, s) => sum + s.location.latitude, 0) /
      validSightings.length;
    const avgLng =
      validSightings.reduce((sum, s) => sum + s.location.longitude, 0) /
      validSightings.length;
    if (isNaN(avgLat) || isNaN(avgLng)) return [12.9141, 74.856];
    return [avgLat, avgLng];
  }, [validSightings]);

  // Compute Path Predictions for all subjects or selected subject
  const multiLocationPredictions: PersonPathPrediction[] = useMemo(() => {
    if (!showPredictivePath) return [];

    if (selectedPersonKey) {
      const filtered = validSightings.filter((s) => getPersonKey(s).key === selectedPersonKey);
      const singlePred = calculatePersonPathPrediction(filtered);
      return singlePred && singlePred.hasMultipleLocations ? [singlePred] : [];
    }

    return getMultiLocationPathPredictions(validSightings);
  }, [validSightings, showPredictivePath, selectedPersonKey]);

  // Asynchronously fetch OSRM street network routes for observed & predicted paths
  useEffect(() => {
    let isCancelled = false;

    if (multiLocationPredictions.length === 0) return;

    async function loadRoadRoutes() {
      const newMap = new Map<string, RoadRouteData>();

      for (const pred of multiLocationPredictions) {
        if (isCancelled) break;
        if (!pred.observedPoints || pred.observedPoints.length === 0) continue;

        // 1. Fetch street network route for historical sightings
        const obsRoute = await fetchOSRMRoute(pred.observedPoints, 'driving');

        // 2. Fetch street network route for predicted trajectory
        let predRouteCoordinates: [number, number][] = [];
        let routeSummary = obsRoute.summary;

        const lastObs = pred.observedPoints[pred.observedPoints.length - 1];
        if (lastObs && pred.predictedWaypoints && pred.predictedWaypoints.length >= 1) {
          const predPoints = [
            lastObs,
            ...pred.predictedWaypoints,
          ];
          const predRoute = await fetchOSRMRoute(predPoints, 'driving');
          predRouteCoordinates = predRoute.coordinates;
          if (predRoute.summary) {
            routeSummary = routeSummary ? `${routeSummary} | ${predRoute.summary}` : predRoute.summary;
          }
        }

        if (!isCancelled) {
          newMap.set(pred.personKey, {
            observedRoadCoords: obsRoute.coordinates,
            predictedRoadCoords: predRouteCoordinates,
            summary: routeSummary,
          });
        }
      }

      if (!isCancelled) {
        setRoadRoutesMap(newMap);
      }
    }

    loadRoadRoutes();

    return () => {
      isCancelled = true;
    };
  }, [multiLocationPredictions]);

  // Single person sequence polyline positions if viewing a single person without predictive mode
  const singlePersonPolylinePositions: [number, number][] = useMemo(() => {
    if (multiLocationPredictions.length > 0) return [];
    const sorted = [...validSightings].sort(
      (a, b) => new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
    );
    return sorted.map((s) => [s.location.latitude, s.location.longitude]);
  }, [validSightings, multiLocationPredictions]);

  const mapTileUrl =
    import.meta.env.VITE_MAP_TILE_URL ||
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm" style={{ height }}>
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

        {/* Fallback simple sequence line */}
        {showSequenceLine && singlePersonPolylinePositions.length > 1 && (
          <Polyline
            positions={singlePersonPolylinePositions}
            pathOptions={{
              color: '#0f172a',
              weight: 3,
              dashArray: '6, 6',
              opacity: 0.8,
            }}
          />
        )}

        {/* MULTI-LOCATION ROAD NETWORK TRAJECTORIES */}
        {showPredictivePath &&
          multiLocationPredictions.map((pred) => {
            const roadData = roadRoutesMap.get(pred.personKey);

            const observedPositions: [number, number][] =
              roadData?.observedRoadCoords && roadData.observedRoadCoords.length > 0
                ? roadData.observedRoadCoords
                : pred.observedPoints.map((p) => [p.latitude, p.longitude]);

            const lastObserved = pred.observedPoints[pred.observedPoints.length - 1];
            const firstPredicted = pred.predictedWaypoints?.[0];
            const secondPredicted = pred.predictedWaypoints?.[1];

            if (!lastObserved || !firstPredicted) return null;

            const predictedPositions: [number, number][] =
              roadData?.predictedRoadCoords && roadData.predictedRoadCoords.length > 0
                ? roadData.predictedRoadCoords
                : [
                    [lastObserved.latitude, lastObserved.longitude],
                    [firstPredicted.latitude, firstPredicted.longitude],
                    secondPredicted ? [secondPredicted.latitude, secondPredicted.longitude] : [firstPredicted.latitude, firstPredicted.longitude],
                  ];

            const pathColor = pred.identityType === 'KNOWN' ? '#059669' : '#0f172a';

            return (
              <React.Fragment key={pred.personKey}>
                {/* 1. Observed Historical Street Route Polyline */}
                {observedPositions.length > 1 && (
                  <Polyline
                    positions={observedPositions}
                    pathOptions={{
                      color: pathColor,
                      weight: 4,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}

                {/* 2. Predicted Future Street Route Polyline */}
                {predictedPositions.length > 1 && (
                  <Polyline
                    positions={predictedPositions}
                    pathOptions={{
                      color: '#4f46e5',
                      weight: 4,
                      dashArray: '6, 6',
                      className: 'animated-predicted-polyline',
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                  />
                )}

                {/* 3. Uncertainty / Probability Radius Circle around Predicted Next Location */}
                <Circle
                  center={[firstPredicted.latitude, firstPredicted.longitude]}
                  radius={pred.uncertaintyRadiusMeters || 150}
                  pathOptions={{
                    color: '#6366f1',
                    fillColor: '#6366f1',
                    fillOpacity: 0.12,
                    weight: 1.5,
                    dashArray: '4, 4',
                  }}
                />

                {/* 4. Target Markers for Predicted Waypoints (+15m & +30m) */}
                {(pred.predictedWaypoints || []).map((wp, idx) => (
                  <Marker
                    key={`${pred.personKey}_wp_${idx}`}
                    position={[wp.latitude, wp.longitude]}
                    icon={createPredictedTargetIcon(`+${wp.minutesAhead}m`)}
                  >
                    <Popup className="predicted-popup">
                      <div className="p-2.5 max-w-xs space-y-2 select-none text-slate-800 font-sans">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
                          <span className="font-bold text-xs text-indigo-900 flex items-center gap-1 font-mono">
                            🎯 Probable Destination
                          </span>
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
                            +{wp.minutesAhead}m
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-900">
                          Subject: {pred.personName}
                        </p>

                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/80 text-[11px] space-y-1 text-slate-800">
                          <p className="flex items-center justify-between">
                            <strong>Estimated Time (ETA):</strong>
                            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{wp.estimatedTime}</span>
                          </p>
                          <p className="flex items-center justify-between">
                            <strong>Heading / Direction:</strong>
                            <span className="font-semibold">{pred.bearingLabel}</span>
                          </p>
                          {roadData?.summary && (
                            <p className="text-[10px] text-slate-600 font-semibold border-t border-slate-200/80 pt-1">
                              Route: {roadData.summary}
                            </p>
                          )}
                          <p className="flex items-center justify-between">
                            <strong>Estimated Speed:</strong>
                            <span className="font-mono">{pred.recentSpeedKmH || 4.5} km/h</span>
                          </p>
                        </div>

                        <div className="text-[10px] text-slate-500 space-y-0.5 border-t border-slate-100 pt-1.5">
                          <p>
                            <strong>Last Seen Location:</strong> {pred.lastSeenLocationName}
                          </p>
                          <p className="font-mono text-[9px] text-slate-400">
                            Coords: {wp.latitude.toFixed(4)}, {wp.longitude.toFixed(4)}
                          </p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </React.Fragment>
            );
          })}

        {/* Observed Sightings Markers */}
        {validSightings.map((sighting) => {
          const pos: [number, number] = [sighting.location.latitude, sighting.location.longitude];
          const personInfo = getPersonKey(sighting);
          const targetPred = multiLocationPredictions.find((p) => p.personKey === personInfo.key);

          let sequenceNumber: number | undefined = undefined;
          if (targetPred) {
            const pt = targetPred.observedPoints.find((p) => p.sightingId === sighting._id);
            if (pt) sequenceNumber = pt.sequenceNumber;
          }

          const unknownStatus =
            typeof sighting.unknownPersonId === 'object' && sighting.unknownPersonId !== null
              ? sighting.unknownPersonId.status
              : undefined;

          const icon = sequenceNumber
            ? createStepIcon(sequenceNumber, sighting.identityType === 'KNOWN')
            : getCustomIcon(sighting.identityType, unknownStatus);

          const identityLabel =
            sighting.identityType === 'KNOWN'
              ? (typeof sighting.personId === 'object' && sighting.personId !== null ? sighting.personId.missingPersonName : undefined) || 'Registered Person'
              : (typeof sighting.unknownPersonId === 'object' && sighting.unknownPersonId !== null ? sighting.unknownPersonId.unknownId : undefined) || 'Unknown Person';

          const snapshotPath = sighting.snapshotObjectKey;

          return (
            <Marker key={sighting._id} position={pos} icon={icon}>
              <Popup className="sighting-popup">
                <div className="p-2 max-w-xs space-y-2 select-none text-slate-800 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 gap-2">
                    <span className="font-bold text-xs truncate font-mono text-slate-900">
                      {sequenceNumber ? `#${sequenceNumber} — ` : ''}{identityLabel}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full text-white ${
                        sighting.identityType === 'KNOWN' ? 'bg-emerald-600' : 'bg-slate-900'
                      }`}
                    >
                      {sighting.identityType}
                    </span>
                  </div>

                  {snapshotPath && (
                    <img
                      src={getSnapshotUrl(snapshotPath)}
                      alt="Detection Snapshot"
                      className="w-full h-32 rounded-lg object-cover border border-slate-200/80 shadow-xs"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}

                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-slate-900 flex items-center gap-1">
                      📍 {sighting.location?.name || 'Unknown Location'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {new Date(sighting.detectedAt).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                        Match: {Math.round(sighting.similarity * 100)}%
                      </span>
                      <span className="font-mono text-slate-400">
                        {sighting.sourceType === 'LIVE_CCTV'
                          ? `Cam: ${typeof sighting.cameraId === 'object' && sighting.cameraId !== null ? sighting.cameraId.name : 'CCTV'}`
                          : `Vid: ${typeof sighting.videoId === 'object' && sighting.videoId !== null ? sighting.videoId.originalName : 'Upload'}`}
                      </span>
                    </div>
                  </div>

                  {targetPred && (
                    <div className="bg-slate-900 text-white text-[10px] p-2 rounded-lg space-y-0.5">
                      <p className="font-bold text-slate-200 flex items-center gap-1">
                        <Compass className="h-3 w-3 text-indigo-400" />
                        Predicted Heading: {targetPred.bearingLabel}
                      </p>
                      <p className="text-slate-400 font-mono">
                        Speed: {targetPred.recentSpeedKmH} km/h
                      </p>
                    </div>
                  )}

                  {onSelectSighting && (
                    <button
                      type="button"
                      onClick={() => onSelectSighting(sighting)}
                      className="w-full py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs mt-1"
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

      {/* Floating Path Legend / Overlay */}
      {showPredictivePath && multiLocationPredictions.length > 0 && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md text-slate-900 text-[10px] p-3 rounded-xl shadow-md border border-slate-200 max-w-xs space-y-1.5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1 font-bold">
            <span className="flex items-center gap-1.5 text-slate-900 font-semibold">
              <Navigation className="h-3.5 w-3.5 text-slate-700" />
              Trajectory Legend
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-mono border border-slate-200">
              {multiLocationPredictions.length} Active
            </span>
          </div>

          <div className="space-y-1 text-[9.5px] text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-emerald-600 rounded-full"></span>
              <span>Solid Line: Observed Camera Path</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-indigo-600 rounded-full border border-indigo-400"></span>
              <span>Dashed Line: Predicted Street Route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs">🎯</span>
              <span>Target Icon: Estimated Location (+15m/+30m)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
