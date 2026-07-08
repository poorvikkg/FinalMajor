import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { PageWrapper } from '../components/layout/PageWrapper';

// Pages
import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { Dashboard } from '../pages/dashboard/Dashboard';
import { LiveMonitoring } from '../pages/monitoring/LiveMonitoring';
import { CameraManagement } from '../pages/cameras/CameraManagement';
import { RecognitionLogs } from '../pages/logs/RecognitionLogs';
import { UnknownFaces } from '../pages/logs/UnknownFaces';
import { ComplaintManagement } from '../pages/complaints/ComplaintManagement';
import { UserManagement } from '../pages/users/UserManagement';
import { Settings } from '../pages/settings/Settings';
import { FileCase } from '../pages/cases/FileCase';
import { AnalyseVideo } from '../pages/analysis/AnalyseVideo';

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

  // Viewer role: redirect everything except /complaints and /file-case to /complaints
  if (user?.role === 'viewer') {
    if (allowedRoles && !allowedRoles.includes('viewer')) {
      return <Navigate to="/complaints" replace />;
    }
  }

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

        {/* Root: admin/operator → Dashboard, viewer → complaints */}
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin / Operator only */}
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <LiveMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cameras"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <CameraManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <RecognitionLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unknown-faces"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
              <UnknownFaces />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyse"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator']}>
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

        {/* Viewer + Admin + Operator */}
        <Route
          path="/complaints"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator', 'viewer']}>
              <ComplaintManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/file-case"
          element={
            <ProtectedRoute allowedRoles={['admin', 'operator', 'viewer']}>
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
