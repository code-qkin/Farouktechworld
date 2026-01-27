import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { db, auth } from '../../firebaseConfig'; 
import { useAuth } from '../AdminContext'; 

// 🔥 ADDED 'manager'
const ALLOWED_DASHBOARD_ROLES = ['admin', 'secretary', 'worker', 'ceo', 'manager'];

const AdminGuard = () => {
  const { user, role, loading, setUser, setRole, setViewRole } = useAuth();

  useEffect(() => {
    if (loading || !user?.uid) return;

    const userRef = doc(db, 'Users', user.uid);
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();

            // 🔥 CHECK EMAIL VERIFICATION
            if (auth.currentUser && !auth.currentUser.emailVerified) {
                auth.signOut();
                // We rely on the redirect to login page where they can see why they were kicked out if they try again
                return;
            }

            if (userData.status === 'suspended') {
                auth.signOut();
                alert("Session Terminated: Your account has been suspended.");
                return;
            }

            if (ALLOWED_DASHBOARD_ROLES.includes(userData.role)) {
                if (userData.role !== role) {
                    setUser(prev => ({ ...prev, ...userData }));
                    setRole(userData.role);
                    setViewRole(userData.role); 
                }
            } else {
                auth.signOut();
            }
        } else {
            auth.signOut();
        }
    });

    return () => unsubscribe();

  }, [user?.uid, role, loading, setUser, setRole, setViewRole]); 

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-900"></div>
      </div>
    );
  }

  return (user && role) ? <Outlet /> : <Navigate to="/admin/login" replace />;
};

export default AdminGuard;