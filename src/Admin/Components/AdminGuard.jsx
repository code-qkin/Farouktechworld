import React, { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore'; // Use onSnapshot for real-time kick
import { auth, db } from '../../firebaseConfig'; 
import { useAuth } from '../AdminContext'; 

const ALLOWED_DASHBOARD_ROLES = ['admin', 'secretary', 'worker'];

const AdminGuard = () => {
  const { user, role, loading, setUser, setRole, setLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // ✅ REAL-TIME LISTENER: Watch the user's document 24/7
        const userRef = doc(db, 'Users', currentUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();

                // 1. CHECK SUSPENSION (Real-time Kick)
                if (userData.status === 'suspended') {
                    console.warn("User suspended. Logging out...");
                    auth.signOut();
                    setUser(null);
                    setRole(null);
                    alert("Session Terminated: Your account has been suspended.");
                    return;
                }

                // 2. UPDATE CONTEXT (If role changes live)
                if (ALLOWED_DASHBOARD_ROLES.includes(userData.role)) {
                    setUser({ uid: currentUser.uid, email: currentUser.email, ...userData });
                    setRole(userData.role);
                } else {
                    auth.signOut();
                }
            } else {
                // Document deleted? Kick them out.
                auth.signOut();
            }
            setIsChecking(false);
            setLoading(false);
        }, (error) => {
            console.error("Profile Sync Error:", error);
            setIsChecking(false);
            setLoading(false);
        });

      } else {
        // Not logged in
        setUser(null);
        setRole(null);
        setIsChecking(false);
        setLoading(false);
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  if (loading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-900"></div>
      </div>
    );
  }

  if (role) {
    return <Outlet />;
  } 
  
  return <Navigate to="/admin/login" replace />;
};

export default AdminGuard;