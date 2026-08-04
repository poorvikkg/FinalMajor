import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { PageWrapper } from '../components/layout/PageWrapper';

// Pages
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { CommandCenter } from '../pages/dashboard/CommandCenter';
import { LiveMonitoring } from '../pages/monitoring/LiveMonitoring';
import { CameraManagement } from '../pages/cameras/CameraManagement';
import { RecognitionLogs } from '../pages/logs/RecognitionLogs';
import { UnknownFaces } from '../pages/logs/UnknownFaces';
import { ComplaintManagement } from '../pages/complaints/ComplaintManagement';
import { UserManagement } from '../pages/users/UserManagement';
import { Settings } from '../pages/settings/Settings';
import { FileCase } from '../pages/cases/FileCase';
import { AnalyseVideo } from '../pages/analysis/AnalyseVideo';
import { RecurringUnknowns } from '../pages/unknowns/RecurringUnknowns';
import { DetectionMapPage } from '../pages/map/DetectionMapPage';
import { SuspectChaseMap } from '../pages/suspects/SuspectChaseMap';
import { SuspectAlertList } from '../pages/suspects/SuspectAlertList';
import { ThreatLeaderboard } from '../pages/analytics/ThreatLeaderboard';
import { AccompliceDetection } from '../pages/analytics/AccompliceDetection';
import { GeofenceManager } from '../pages/zones/GeofenceManager';
import { SuspectTimeline } from '../pages/suspects/SuspectTimeline';

interface ProtectedProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, hydrate } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  const token = localStorage.getItem('surveillance_token');

  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />;
  }

  // Viewer role checks removed since we only have admin/station

  // Other restricted pages
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/complaints" replace />;
  }

  return <PageWrapper>{children}</PageWrapper>;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Root: admin → CommandCenter, station/viewer → complaints */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CommandCenter />
            </ProtectedRoute>
          }
        />

        {/* Admin only */}
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <LiveMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cameras"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <CameraManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RecognitionLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unknown-faces"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UnknownFaces />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recurring-unknowns"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RecurringUnknowns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/detection-map"
          element={
            <ProtectedRoute allowedRoles={['admin', 'station']}>
              <DetectionMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suspects/chase-map"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SuspectChaseMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suspects/alerts"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SuspectAlertList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suspects/timeline/:suspectId"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SuspectTimeline />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/threats"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ThreatLeaderboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/accomplices"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AccompliceDetection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/zones"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <GeofenceManager />
            </ProtectedRoute>
          }
        />
        <Route path="/suspects" element={<Navigate to="/suspects/alerts" replace />} />
        <Route
          path="/analyse"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AnalyseVideo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Viewer + Admin + Station */}
        <Route
          path="/complaints"
          element={
            <ProtectedRoute allowedRoles={['admin', 'station', 'viewer']}>
              <ComplaintManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/file-case"
          element={
            <ProtectedRoute allowedRoles={['admin', 'station', 'viewer']}>
              <FileCase />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
