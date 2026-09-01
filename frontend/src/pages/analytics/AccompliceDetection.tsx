/**
 * AccompliceDetection.tsx
 *
 * Link Analysis Engine for Accomplice Detection.
 * Renders an interactive force-directed network graph of suspects who have
 * co-occurred spatially and temporally.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Network,
  Clock,
  MapPin,
  Sliders,
  Calendar,
  Search,
  User,
  X,
  Info,
  RefreshCw,
  Eye,
} from 'lucide-react';
import api from '../../api';
import { getSnapshotUrl } from '../../utils/pathPrediction';

// Types matching the backend response
interface SightingInfo {
  id: string;
  detectedAt: string;
  snapshot: string;
  similarity: number;
  videoName?: string;
}

interface CoOccurrenceDetail {
  timestamp: string;
  locationName: string;
  cameraId?: string;
  cameraName?: string;
  timeDifferenceSeconds: number;
  sightingA: SightingInfo;
  sightingB: SightingInfo;
}

interface AccompliceNode {
  id: string;
  name: string;
  type: 'KNOWN' | 'UNKNOWN';
  snapshot: string;
  status: string;
  // Simulation fields added dynamically
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface AccompliceLink {
  source: string; // node ID
  target: string; // node ID
  value: number; // weight
  coOccurrences: CoOccurrenceDetail[];
}

interface GraphData {
  nodes: AccompliceNode[];
  links: AccompliceLink[];
}

// Simple internal interface for select list
interface SuspectListItem {
  id: string; // DB ObjectId
  key: string; // "person:<id>" or "unknown:<id>"
  label: string;
  type: 'KNOWN' | 'UNKNOWN';
  snapshot: string;
}

export const AccompliceDetection: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusKey = searchParams.get('focusKey');

  // Parameters
  const [timeWindow, setTimeWindow] = useState<number>(120);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(50);
  const [minCoOccurrences, setMinCoOccurrences] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [targetSuspect, setTargetSuspect] = useState<SuspectListItem | null>(null);
  
  // UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuspectDropdown, setShowSuspectDropdown] = useState(false);
  const [selectedLink, setSelectedLink] = useState<AccompliceLink | null>(null);
  const [selectedNode, setSelectedNode] = useState<AccompliceNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Physics settings
  const canvasWidth = 800;
  const canvasHeight = 550;
  const kRepel = 18000;
  const kAttract = 0.04;
  const kGravity = 0.015;
  const restLength = 120;
  const friction = 0.85;

  // Refs for dragging
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingNodeRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // 1. Fetch complaints list
  const { data: complaints = [] } = useQuery({
    queryKey: ['complaints-list-accomplices'],
    queryFn: async () => {
      try {
        const res = await api.get('/complaints?limit=300');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  // 2. Fetch unknown list
  const { data: unknowns = [] } = useQuery({
    queryKey: ['unknowns-list-accomplices'],
    queryFn: async () => {
      try {
        const res = await api.get('/unknown-persons?limit=300');
        return res.data.data || [];
      } catch {
        return [];
      }
    },
  });

  // Combine suspects list for search dropdown
  const suspectList = useMemo<SuspectListItem[]>(() => {
    const list: SuspectListItem[] = [];

    complaints.forEach((c: any) => {
      list.push({
        id: c._id,
        key: `person:${c._id}`,
        label: c.missingPersonName || c.complaintId || 'Known Missing Person',
        type: 'KNOWN',
        snapshot: c.attachments?.[0] || '',
      });
    });

    unknowns.forEach((u: any) => {
      list.push({
        id: u._id,
        key: `unknown:${u._id}`,
        label: u.unknownId || 'Unknown Recurring Person',
        type: 'UNKNOWN',
        snapshot: u.representativeSnapshot || '',
      });
    });

    return list;
  }, [complaints, unknowns]);

  // Load targetSuspect from URL query parameter focusKey on mount
  useEffect(() => {
    if (focusKey && suspectList.length > 0) {
      const match = suspectList.find((s) => s.key === focusKey || s.id === focusKey);
      if (match) {
        setTargetSuspect(match);
        // Clear param to keep clean URLs
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('focusKey');
        setSearchParams(nextParams);
      }
    }
  }, [focusKey, suspectList, searchParams, setSearchParams]);

  // Filtered dropdown items
  const filteredSuspectList = useMemo(() => {
    if (!searchQuery.trim()) return suspectList;
    const q = searchQuery.toLowerCase();
    return suspectList.filter((item) => item.label.toLowerCase().includes(q));
  }, [suspectList, searchQuery]);

  // 3. Fetch Accomplice Graph Data
  const { data: graphRaw, isLoading, refetch } = useQuery<GraphData>({
    queryKey: [
      'accomplice-graph',
      timeWindow,
      distanceThreshold,
      minCoOccurrences,
      startDate,
      endDate,
      targetSuspect?.id,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {
        timeWindowSeconds: timeWindow,
        distanceThresholdMeters: distanceThreshold,
        minCoOccurrences,
      };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (targetSuspect) params.targetId = targetSuspect.id;

      const res = await api.get('/analytics/accomplice-detection', { params });
      return res.data.data;
    },
    enabled: true,
  });

  // State to hold nodes and links for physics updates
  const [simulationState, setSimulationState] = useState<{
    nodes: AccompliceNode[];
    links: AccompliceLink[];
  }>({ nodes: [], links: [] });

  // Initialize node layout whenever graph data updates
  useEffect(() => {
    if (!graphRaw) return;

    // Preserve positions of existing nodes to prevent jumpiness
    const existingPosMap = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    simulationState.nodes.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        existingPosMap.set(n.id, { x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0 });
      }
    });

    const initializedNodes = graphRaw.nodes.map((node, index) => {
      const prev = existingPosMap.get(node.id);
      if (prev) {
        return { ...node, x: prev.x, y: prev.y, vx: prev.vx, vy: prev.vy };
      }

      // Arrange nodes in a circle as initialization
      const angle = (index / (graphRaw.nodes.length || 1)) * 2 * Math.PI;
      const radius = 150 + Math.random() * 50;
      return {
        ...node,
        x: canvasWidth / 2 + radius * Math.cos(angle),
        y: canvasHeight / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      };
    });

    setSimulationState({
      nodes: initializedNodes,
      links: graphRaw.links,
    });
    setSelectedLink(null);
  }, [graphRaw]);

  // Physics force directed tick animation loop
  useEffect(() => {
    if (simulationState.nodes.length === 0) return;

    let animId: number;

    const tick = () => {
      setSimulationState((prev) => {
        const nodes = prev.nodes.map((n) => ({
          ...n,
          fx: 0,
          fy: 0,
          vx: n.vx || 0,
          vy: n.vy || 0,
          x: n.x || canvasWidth / 2,
          y: n.y || canvasHeight / 2,
        }));

        // 1. Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
          const u = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const v = nodes[j];
            const dx = v.x - u.x;
            const dy = v.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 300) {
              const force = kRepel / (dist * dist);
              const forceX = force * (dx / dist);
              const forceY = force * (dy / dist);
              u.fx -= forceX;
              u.fy -= forceY;
              v.fx += forceX;
              v.fy += forceY;
            }
          }
        }

        // 2. Attraction of links
        prev.links.forEach((link) => {
          const u = nodes.find((n) => n.id === link.source);
          const v = nodes.find((n) => n.id === link.target);
          if (u && v) {
            const dx = v.x - u.x;
            const dy = v.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = kAttract * (dist - restLength);
            const forceX = force * (dx / dist);
            const forceY = force * (dy / dist);
            u.fx += forceX;
            u.fy += forceY;
            v.fx -= forceX;
            v.fy -= forceY;
          }
        });

        // 3. Gravity/Center pulling and updating coordinates
        const updatedNodes = nodes.map((n) => {
          if (n.id === draggingNodeRef.current) {
            // Node is pinned by mouse
            return n;
          }

          const dx = canvasWidth / 2 - n.x;
          const dy = canvasHeight / 2 - n.y;
          n.fx += dx * kGravity;
          n.fy += dy * kGravity;

          n.vx = (n.vx + n.fx) * friction;
          n.vy = (n.vy + n.fy) * friction;

          // Boundary constraint
          const margin = 35;
          let nextX = n.x + n.vx;
          let nextY = n.y + n.vy;

          if (nextX < margin) { nextX = margin; n.vx = 0; }
          if (nextX > canvasWidth - margin) { nextX = canvasWidth - margin; n.vx = 0; }
          if (nextY < margin) { nextY = margin; n.vy = 0; }
          if (nextY > canvasHeight - margin) { nextY = canvasHeight - margin; n.vy = 0; }

          return {
            ...n,
            x: nextX,
            y: nextY,
            vx: n.vx,
            vy: n.vy,
          };
        });

        return {
          nodes: updatedNodes,
          links: prev.links,
        };
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [simulationState.nodes.length]);

  // Handle Drag Events (fixed with responsive layout scaling)
  const handleNodeMouseDown = (e: React.MouseEvent, node: AccompliceNode) => {
    e.preventDefault();
    draggingNodeRef.current = node.id;
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
      const mouseY = ((e.clientY - rect.top) / rect.height) * canvasHeight;
      dragOffsetRef.current = {
        x: mouseX - (node.x || 0),
        y: mouseY - (node.y || 0),
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * canvasWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * canvasHeight;

    setSimulationState((prev) => {
      const nodes = prev.nodes.map((n) => {
        if (n.id === draggingNodeRef.current) {
          return {
            ...n,
            x: mouseX - dragOffsetRef.current.x,
            y: mouseY - dragOffsetRef.current.y,
            vx: 0,
            vy: 0,
          };
        }
        return n;
      });
      return { nodes, links: prev.links };
    });
  };

  const handleMouseUpOrLeave = () => {
    draggingNodeRef.current = null;
  };

  // Helper to determine if a node or edge is dimmed due to highlighting
  const isDimmed = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    if (hoveredNodeId === nodeId) return false;

    // Check if there is a link connecting hoveredNodeId and nodeId
    const linked = simulationState.links.some(
      (l) =>
        (l.source === hoveredNodeId && l.target === nodeId) ||
        (l.target === hoveredNodeId && l.source === nodeId)
    );
    return !linked;
  };

  const isLinkDimmed = (link: AccompliceLink) => {
    if (!hoveredNodeId) return false;
    return link.source !== hoveredNodeId && link.target !== hoveredNodeId;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 shadow-md">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-heading">Link Analysis Engine</h1>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-sm border border-slate-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Graph
        </button>
      </div>

      {/* ── Configuration Controls ── */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Target Suspect Focus Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-medium text-slate-500 block">
              Suspect Filter
            </label>
            <div className="relative">
              {targetSuspect ? (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    {targetSuspect.snapshot ? (
                      <img
                        src={targetSuspect.snapshot}
                        alt=""
                        className="w-4 h-4 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="font-medium truncate">{targetSuspect.label}</span>
                  </div>
                  <button
                    onClick={() => setTargetSuspect(null)}
                    className="p-0.5 rounded hover:bg-slate-200 text-slate-500 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search suspects..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuspectDropdown(true);
                    }}
                    onFocus={() => setShowSuspectDropdown(true)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-slate-800 focus:outline-none text-xs text-slate-800"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                </div>
              )}

              {/* Dropdown Box */}
              {showSuspectDropdown && !targetSuspect && (
                <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-100">
                  {filteredSuspectList.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">No suspects found</div>
                  ) : (
                    filteredSuspectList.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setTargetSuspect(item);
                          setSearchQuery('');
                          setShowSuspectDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left transition"
                      >
                        <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.snapshot ? (
                            <img src={getSnapshotUrl(item.snapshot)} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-medium text-slate-800 truncate">{item.label}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {showSuspectDropdown && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSuspectDropdown(false)}
              />
            )}
          </div>

          {/* Time Window Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Time Window</span>
              <span className="font-semibold text-slate-800">{Math.floor(timeWindow / 60)}m {timeWindow % 60}s</span>
            </div>
            <input
              type="range"
              min={30}
              max={600}
              step={10}
              value={timeWindow}
              onChange={(e) => setTimeWindow(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-100 accent-slate-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Distance Threshold Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Distance Threshold</span>
              <span className="font-semibold text-slate-800">{distanceThreshold}m</span>
            </div>
            <input
              type="range"
              min={10}
              max={250}
              step={5}
              value={distanceThreshold}
              onChange={(e) => setDistanceThreshold(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-100 accent-slate-900 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Date Boundaries & Min Co-occurrences */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2.5 border-t border-slate-100">
          <div className="space-y-1">
            <label className="text-xs text-slate-500 block">
              Min Encounters
            </label>
            <select
              value={minCoOccurrences}
              onChange={(e) => setMinCoOccurrences(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
            >
              <option value={1}>1+ time</option>
              <option value={2}>2+ times</option>
              <option value={3}>3+ times</option>
              <option value={5}>5+ times</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 block">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500 block">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none"
            />
          </div>

          <div className="flex items-end">
            {(startDate || endDate || targetSuspect || minCoOccurrences > 1) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setTargetSuspect(null);
                  setMinCoOccurrences(1);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Graph Canvas & Sidebar Details ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Network Graph Box */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs flex flex-col relative min-h-[550px]">
          {/* Legend and stats */}
          <div className="px-4 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 z-10 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-700 bg-white" />
                <span>Known ({simulationState.nodes.filter(n => n.type === 'KNOWN').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-400 bg-white" />
                <span>Unknown ({simulationState.nodes.filter(n => n.type === 'UNKNOWN').length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-slate-300" />
                <span>Links ({simulationState.links.length})</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Drag nodes to organize. Click links for evidence.</span>
            </div>
          </div>

          {/* Svg canvas */}
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-800" />
              <span className="text-xs font-semibold">Running co-occurrence spatial-temporal query...</span>
            </div>
          ) : simulationState.nodes.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <Network className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-800 font-heading">No Co-occurrences Found</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Try broadening your time proximity window, increasing distance tolerance, or choosing a different date range.
              </p>
            </div>
          ) : (
            <svg
              ref={svgRef}
              width="100%"
              height={canvasHeight}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex-1 select-none cursor-grab active:cursor-grabbing bg-slate-50/20"
            >
              {/* Pattern definitions for avatars */}
              <defs>
                {simulationState.nodes.map((node) => (
                  <pattern
                    key={`pat-${node.id}`}
                    id={`pat-${node.id.replace(':', '-')}`}
                    x="0"
                    y="0"
                    height="1"
                    width="1"
                    patternContentUnits="objectBoundingBox"
                  >
                    <image
                      x="0"
                      y="0"
                      height="1"
                      width="1"
                      preserveAspectRatio="xMidYMid slice"
                      href={getSnapshotUrl(node.snapshot) || 'https://via.placeholder.com/150'}
                    />
                  </pattern>
                ))}
              </defs>

              {/* Render edges (fixed bug to only render lines between active/existing nodes) */}
              {simulationState.links.map((link, idx) => {
                const sourceNode = simulationState.nodes.find((n) => n.id === link.source);
                const targetNode = simulationState.nodes.find((n) => n.id === link.target);
                if (!sourceNode || !targetNode) return null;

                const sourceCoord = { x: sourceNode.x || 0, y: sourceNode.y || 0 };
                const targetCoord = { x: targetNode.x || 0, y: targetNode.y || 0 };

                const isHovered = hoveredNodeId === link.source || hoveredNodeId === link.target;
                const isSelected = selectedLink?.source === link.source && selectedLink?.target === link.target;

                // Center point for label
                const midX = (sourceCoord.x + targetCoord.x) / 2;
                const midY = (sourceCoord.y + targetCoord.y) / 2;

                return (
                  <g
                    key={`link-${idx}`}
                    className="cursor-pointer group"
                    onClick={() => {
                      setSelectedLink(link);
                      setSelectedNode(null);
                    }}
                  >
                    {/* Wider invisible stroke to make selection easy */}
                    <line
                      x1={sourceCoord.x}
                      y1={sourceCoord.y}
                      x2={targetCoord.x}
                      y2={targetCoord.y}
                      stroke="transparent"
                      strokeWidth={14}
                    />
                    {/* Displayed link line (updated with professional charcoal/slate colors) */}
                    <line
                      x1={sourceCoord.x}
                      y1={sourceCoord.y}
                      x2={targetCoord.x}
                      y2={targetCoord.y}
                      stroke={
                        isSelected
                          ? '#0f172a' // Dark charcoal selected
                          : isHovered
                          ? '#475569' // Slate-600 hovered
                          : isLinkDimmed(link)
                          ? 'rgba(241, 245, 249, 0.3)' // Dimmed color
                          : '#e2e8f0' // Light slate-200 normal
                      }
                      strokeWidth={Math.min(link.value * 2 + 1, 9)}
                      strokeDasharray={isSelected ? '4 3' : undefined}
                      className="transition-all duration-200"
                    />

                    {/* Weight Label Box */}
                    {!isLinkDimmed(link) && (
                      <g className="transition-all duration-200">
                        <rect
                          x={midX - 14}
                          y={midY - 8}
                          width={28}
                          height={16}
                          rx={8}
                          fill={isSelected ? '#0f172a' : '#f8fafc'}
                          stroke={isSelected ? '#0f172a' : '#e2e8f0'}
                          strokeWidth={1}
                        />
                        <text
                          x={midX}
                          y={midY + 4}
                          textAnchor="middle"
                          fill={isSelected ? '#ffffff' : '#475569'}
                          fontSize={9}
                          fontWeight="black"
                        >
                          {link.value}x
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Render nodes */}
              {simulationState.nodes.map((node) => {
                const isCurrentHovered = hoveredNodeId === node.id;
                const isNodeDimmed = isDimmed(node.id);
                const isSelected = selectedNode?.id === node.id;
                const hasFocus = targetSuspect?.key === node.id;

                const nodeSize = isCurrentHovered || isSelected ? 30 : 25;
                const strokeColor = node.type === 'KNOWN' ? '#334155' : '#64748b'; // Slate border colors

                return (
                  <g
                    key={`node-${node.id}`}
                    transform={`translate(${node.x || 0}, ${node.y || 0})`}
                    className="cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(e) => {
                      if (e.detail === 1) {
                        setSelectedNode(node);
                        setSelectedLink(null);
                      }
                    }}
                  >
                    {/* Outer focus rings (slate-themed) */}
                    <circle
                      r={nodeSize + (hasFocus ? 6 : 4)}
                      fill="transparent"
                      stroke={hasFocus ? '#0f172a' : strokeColor}
                      strokeWidth={hasFocus ? 2.5 : 1}
                      strokeDasharray={hasFocus ? '3 2' : undefined}
                      opacity={isNodeDimmed ? 0.15 : 0.8}
                      className="transition-all duration-200"
                    />

                    {/* Main Circle Filled with Suspect Snapshot */}
                    <circle
                      r={nodeSize}
                      fill={`url(#pat-${node.id.replace(':', '-')})`}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4 : 2}
                      opacity={isNodeDimmed ? 0.25 : 1}
                      className="transition-all duration-200"
                    />

                    {/* Text Label Background */}
                    {!isNodeDimmed && (
                      <g transform={`translate(0, ${nodeSize + 14})`}>
                        <rect
                          x={-50}
                          y={-9}
                          width={100}
                          height={15}
                          rx={4}
                          fill="rgba(15, 23, 42, 0.75)"
                        />
                        <text
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={9}
                          fontWeight="bold"
                          className="pointer-events-none"
                        >
                          {node.name.length > 15 ? `${node.name.slice(0, 13)}...` : node.name}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* ── Details Panel / Timeline Drawer ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col min-h-[550px] relative">
          {selectedLink ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Network className="w-4.5 h-4.5 text-slate-800" />
                  <h3 className="text-sm font-bold text-slate-800">Connection Evidence Logs</h3>
                </div>
                <button
                  onClick={() => setSelectedLink(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Target Suspect summaries */}
              <div className="my-4 flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/50 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                    <img
                      src={
                        getSnapshotUrl(simulationState.nodes.find((n) => n.id === selectedLink.source)?.snapshot) ||
                        'https://via.placeholder.com/150'
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs font-black text-slate-800 truncate">
                    {simulationState.nodes.find((n) => n.id === selectedLink.source)?.name}
                  </span>
                </div>
                <div className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex flex-col items-center flex-shrink-0">
                  <span>Linked</span>
                  <span className="text-xs font-extrabold">{selectedLink.value}x times</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-black text-slate-800 truncate">
                    {simulationState.nodes.find((n) => n.id === selectedLink.target)?.name}
                  </span>
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                    <img
                      src={
                        getSnapshotUrl(simulationState.nodes.find((n) => n.id === selectedLink.target)?.snapshot) ||
                        'https://via.placeholder.com/150'
                      }
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* Scrollable details list */}
              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                {selectedLink.coOccurrences.map((co, i) => (
                  <div key={i} className="border border-slate-100 rounded-xl p-3 bg-slate-50/30 space-y-3 shadow-sm hover:border-slate-200 transition-colors">
                    {/* Timestamp and Camera Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span className="truncate">{co.locationName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Offset: {co.timeDifferenceSeconds}s</span>
                      </div>
                    </div>

                    {/* Sighting images side-by-side */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1 relative">
                        <div className="h-24 w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
                          <img
                            src={getSnapshotUrl(co.sightingA.snapshot)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 bg-slate-900/60 backdrop-blur-xs px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white">
                            Suspect A
                          </div>
                        </div>
                        <div className="flex justify-between text-[9px] font-medium text-slate-500 px-0.5">
                          <span>Match: {Math.round(co.sightingA.similarity * 100)}%</span>
                        </div>
                      </div>

                      <div className="space-y-1 relative">
                        <div className="h-24 w-full bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
                          <img
                            src={getSnapshotUrl(co.sightingB.snapshot)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 bg-slate-900/60 backdrop-blur-xs px-1.5 py-0.5 rounded text-[8px] font-extrabold text-white">
                            Suspect B
                          </div>
                        </div>
                        <div className="flex justify-between text-[9px] font-medium text-slate-500 px-0.5">
                          <span>Match: {Math.round(co.sightingB.similarity * 100)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Date details */}
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                      <span>Seen At:</span>
                      <span className="text-slate-800 font-black">{new Date(co.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedNode ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <User className="w-4.5 h-4.5 text-slate-800" />
                  <h3 className="text-sm font-bold text-slate-800">Suspect File Summary</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suspect Info Card */}
              <div className="my-5 flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-slate-200/50 flex-shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-md mb-3">
                  <img
                    src={getSnapshotUrl(selectedNode.snapshot) || 'https://via.placeholder.com/150'}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="text-sm font-black text-slate-800 mb-1">{selectedNode.name}</h4>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-extrabold border bg-slate-100 border-slate-200 text-slate-700"
                >
                  {selectedNode.type === 'KNOWN' ? 'Missing Person' : 'Unknown Recurring'}
                </span>
              </div>

              {/* Details and direct connections list */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div className="space-y-2">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Suspect Details</h5>
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 text-xs font-semibold text-slate-600 space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="text-slate-800 font-extrabold">{selectedNode.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Identifier ID:</span>
                      <span className="text-slate-800 font-extrabold truncate max-w-[150px]">{selectedNode.id.split(':')[1]}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Direct Accomplices</h5>
                  <div className="space-y-2">
                    {simulationState.links
                      .filter((l) => l.source === selectedNode.id || l.target === selectedNode.id)
                      .map((link) => {
                        const peerId = link.source === selectedNode.id ? link.target : link.source;
                        const peer = simulationState.nodes.find((n) => n.id === peerId);
                        if (!peer) return null;
                        return (
                          <button
                            key={peer.id}
                            onClick={() => {
                              setSelectedNode(peer);
                              setSelectedLink(null);
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                                <img src={getSnapshotUrl(peer.snapshot)} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate">{peer.name}</span>
                            </div>
                            <span className="text-[10px] font-extrabold text-slate-700 px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                              Seen {link.value}x
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    const dropdownItem = suspectList.find((s) => s.key === selectedNode.id);
                    if (dropdownItem) {
                      setTargetSuspect(dropdownItem);
                      setSelectedNode(null);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  Isolate This Suspect Network
                </button>
              </div>
            </div>
          ) : (
            /* Idle Instruction state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Network className="w-12 h-12 text-slate-200 mb-3" />
              <h3 className="text-sm font-bold text-slate-700 font-heading">Link Diagnostics Panel</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Select any accomplice link line on the graph canvas to inspect co-occurrence evidence timelines, or click a suspect node to view their dossier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccompliceDetection;
