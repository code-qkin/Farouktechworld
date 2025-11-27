// src/Admin/Pages/Dashboard.jsx
import React from 'react';
import { useAuth } from '../../AdminContext';

// Import your three existing dashboards
import AdminDashboard from './Dashboard';
import SecretaryDashboard from './SecretaryDashboard';
import WorkerDashboard from './WorkerDashboard';

const DashboardHandler = () => {
    const { role, user } = useAuth();

    // 🚦 Traffic Control Logic
    switch (role) {
        case 'admin':
            return <AdminDashboard user={user} />;
        case 'secretary':
            return <SecretaryDashboard user={user} />;
        case 'worker':
            return <WorkerDashboard user={user} />;
        default:
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-700">Unknown Role</h2>
                        <p className="text-gray-500">Your account does not have a valid role assigned.</p>
                    </div>
                </div>
            );
    }
};


export default DashboardHandler;