import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl gradient-btn flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-blue-500/25">
            AE
          </div>
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase animate-pulse">
            Authenticating Session...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their respective default home
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'hod') return <Navigate to="/hod/dashboard" replace />;
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return <>{children}</>;
};
