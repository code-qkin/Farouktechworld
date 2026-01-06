import React, { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore'; 
import { db, auth } from '../../firebaseConfig'; 
import { useAuth } from '../AdminContext'; 

const ALLOWED_DASHBOARD_ROLES = ['admin', 'secretary', 'worker'];

const AdminGuard = () => {
  // Get current state from Context
  const { user, role, loading, setUser, setRole, setViewRole } = useAuth();

  useEffect(() => {
    // 1. If app is loading or no user is logged in, skip logic
    if (loading || !user?.uid) return;

    // 2. Listen exclusively to the logged-in user's database record
    const userRef = doc(db, 'Users', user.uid);
    
   
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            const userData = docSnap.data();

            // A. Security Check: Immediate Suspension
            if (userData.status === 'suspended') {
            
                auth.signOut();
                alert("Session Terminated: Your account has been suspended.");
                return;
            }

            // B. Role Sync & View Update
            if (ALLOWED_DASHBOARD_ROLES.includes(userData.role)) {
                
                // Compare Database Role (New) vs. App Role (Current)
                // We use the 'role' variable from the hook, which is fresh thanks to the dependency array
                if (userData.role !== role) {
                  
                    
                    // 1. Update User Profile in Context
                    setUser(prev => ({ ...prev, ...userData }));

                    // 2. Update the official permission level
                    setRole(userData.role);
                    
                    // 3. FORCE THE DASHBOARD TO SWITCH VIEWS
                    // This fixes the issue where you stay stuck on "Worker Dashboard"
                    setViewRole(userData.role); 
                }
            } else {
                // User has an invalid role (e.g. pending), kick them out
              
                auth.signOut();
            }
        } else {
            // User document deleted from database
            auth.signOut();
        }
    }, (error) => {
        
    });

    // Cleanup listener when component unmounts or user/role changes
    return () => unsubscribe();

  }, [user?.uid, role, loading, setUser, setRole, setViewRole]); 
  // 👆 The dependency [role] is crucial. It forces the effect to refresh whenever the role changes,
  // ensuring the comparison logic always has the correct "current" value.

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-purple-900"></div>
      </div>
    );
  }

  // If authenticated and authorized, render the dashboard. Otherwise, redirect.
  return (user && role) ? <Outlet /> : <Navigate to="/admin/login" replace />;
};

export default AdminGuard;