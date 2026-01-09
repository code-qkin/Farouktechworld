import React from 'react';
import { useAuth } from '../../AdminContext';
import { Wrench, ShieldCheck, RefreshCw } from 'lucide-react';

// Import Dashboards
import AdminDashboard from './Dashboard';
import SecretaryDashboard from './SecretaryDashboard';
import WorkerDashboard from './WorkerDashboard';

const DashboardHandler = () => {
    const { user, role, viewRole, setViewRole } = useAuth();

    // 1. Check if user has "Double Role" capabilities
    const canSwitch = (role === 'admin' || role === 'secretary' || role === 'ceo') && user?.isTechnician;

    // 2. Handle The Switch
    const toggleView = () => {
        if (viewRole === 'worker') {
            setViewRole(role); // Go back to Main Role (Admin/Secretary/CEO)
        } else {
            setViewRole('worker'); // Go to Technician Mode
        }
    };

    // 3. Render the correct Dashboard based on VIEW ROLE
    let DashboardComponent;
    switch (viewRole) {
        case 'admin':
        case 'ceo': // 🔥 CEO gets the Admin Dashboard
            DashboardComponent = <AdminDashboard user={user} />;
            break;
        case 'secretary':
            DashboardComponent = <SecretaryDashboard user={user} />;
            break;
        case 'worker':
            // Pass 'true' prop if they are an admin viewing as worker (optional)
            DashboardComponent = <WorkerDashboard user={user} isViewMode={true} />;
            break;
        default:
            DashboardComponent = (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-800">Unknown Role</h2>
                        <p className="text-gray-500">Your role "{viewRole}" is not recognized.</p>
                    </div>
                </div>
            );
    }

    return (
        <div className="relative">
            {/* The Active Dashboard */}
            {DashboardComponent}

            {/* 🔥 FLOATING SWITCHER BUTTON (Only for Dual-Role Users) */}
            {canSwitch && (
                <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
                    <button 
                        onClick={toggleView}
                        className={`flex items-center gap-3 px-6 py-4 rounded-full shadow-2xl font-bold text-white transition-all transform hover:scale-105 ${
                            viewRole === 'worker' 
                            ? 'bg-purple-900 border-4 border-purple-200' // Button to go back to Admin
                            : 'bg-blue-600 border-4 border-blue-200'     // Button to go to Worker
                        }`}
                    >
                        {viewRole === 'worker' ? (
                            <>
                                <ShieldCheck size={24} />
                                <span>Back to Admin</span>
                            </>
                        ) : (
                            <>
                                <Wrench size={24} />
                                <span>Technician Mode</span>
                            </>
                        )}
                        <RefreshCw size={18} className="opacity-50"/>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DashboardHandler;