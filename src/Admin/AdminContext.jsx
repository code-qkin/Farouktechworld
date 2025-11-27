import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig'; // Adjust path if needed
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [role, setRole] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Firebase Auth changes (Login/Logout)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      
      if (currentUser) {
        try {
          // 1. User is logged in, now fetch their Profile from Firestore
          const userDocRef = doc(db, "Users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // 2. MERGE Auth data (uid, email) with Firestore data (name, role)
            // This ensures user.name is available in your app!
            setUser({ 
              uid: currentUser.uid, 
              email: currentUser.email, 
              ...userData 
            });
            setRole(userData.role);
          } else {
            // Fallback if document is missing
            setUser(currentUser);
            setRole(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
          setRole(null);
        }
      } else {
        // User is logged out
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, role, loading, setUser, setRole, setLoading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children} {/* Wait for loading to finish before rendering app */}
    </AuthContext.Provider>
  );
};