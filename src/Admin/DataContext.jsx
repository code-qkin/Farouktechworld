import React, { createContext, useContext, useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [orders, setOrders] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [services, setServices] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Default limit to 500 to save reads. Can be increased by pages that need it.
    const [orderLimit, setOrderLimit] = useState(500);

    const fetchAllOrders = () => {
        // No longer needed as we fetch all natively, keeping for backward compatibility
    };

    useEffect(() => {
        setLoading(true);
        let unsubOrders, unsubInventory, unsubCustomers, unsubServices, unsubUsers;

        try {
            // Orders Listener (No limit, optimized by Firestore local cache)
            const qOrders = query(collection(db, 'Orders'), orderBy('createdAt', 'desc'));
            unsubOrders = onSnapshot(qOrders, (snap) => {
                setOrders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Inventory Listener
            unsubInventory = onSnapshot(query(collection(db, 'Inventory'), orderBy('name')), (snap) => {
                setInventory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Customers Listener
            unsubCustomers = onSnapshot(query(collection(db, 'Customers'), orderBy('name')), (snap) => {
                setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Services Listener
            unsubServices = onSnapshot(collection(db, 'Services'), (snap) => {
                setServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

            // Users Listener
            unsubUsers = onSnapshot(collection(db, 'Users'), (snap) => {
                setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoading(false); // Mark loading as false when last core collection initializes
            });

        } catch (error) {
            console.error('Error initializing global data listeners:', error);
            setLoading(false);
        }

        return () => {
            if (unsubOrders) unsubOrders();
            if (unsubInventory) unsubInventory();
            if (unsubCustomers) unsubCustomers();
            if (unsubServices) unsubServices();
            if (unsubUsers) unsubUsers();
        };
    }, [orderLimit]);

    return (
        <DataContext.Provider value={{ 
            orders, inventory, customers, services, users, loading, 
            orderLimit, fetchAllOrders 
        }}>
            {children || <Outlet />}
        </DataContext.Provider>
    );
};

