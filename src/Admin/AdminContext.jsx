import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig'; 
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [role, setRole] = useState(null); 
  const [viewRole, setViewRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, "Users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            setUser({ 
              uid: currentUser.uid, 
              email: currentUser.email, 
              ...userData 
            });
            
            setRole(userData.role);
            setViewRole(userData.role); 
          } else {
            setUser(currentUser);
            setRole(null);
            setViewRole(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setViewRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, role, viewRole, setViewRole, loading, setUser, setRole, setLoading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};