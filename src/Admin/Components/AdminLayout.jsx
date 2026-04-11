import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, ClipboardList, Package, Users, Settings, 
    LogOut, Menu, X, Smartphone, TrendingUp, Briefcase, 
    Banknote, DollarSign, Image as ImageIcon, Activity, Search
} from 'lucide-react';
import { useAuth } from '../AdminContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store/useStore';
import GlobalSearch from './GlobalSearch'; // We will create this next

const AdminLayout = () => {
    const { user, role, viewRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { isSidebarOpen, toggleSidebar, setSidebarOpen, toggleGlobalSearch } = useStore();

    // Auto-close sidebar on mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [setSidebarOpen]);

    // Close sidebar on route change on mobile
    useEffect(() => {
        if (window.innerWidth < 1024) setSidebarOpen(false);
    }, [location.pathname, setSidebarOpen]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/admin/login');
    };

    const menuItems = [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'secretary', 'ceo', 'worker'] },
        { path: '/admin/orders', icon: ClipboardList, label: 'Orders (POS)', roles: ['admin', 'manager', 'secretary', 'ceo', 'worker'] },
        { path: '/admin/store', icon: Package, label: 'Inventory', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/devices', icon: Smartphone, label: 'Devices', roles: ['admin', 'manager', 'secretary', 'ceo'] },
        { path: '/admin/users', icon: Users, label: 'Staff', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/customers', icon: Users, label: 'Customers', roles: ['admin', 'manager', 'secretary', 'ceo'] },
        { path: '/admin/performance', icon: TrendingUp, label: 'Performance', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/job-history', icon: Briefcase, label: 'Job History', roles: ['admin', 'manager', 'ceo', 'worker'] },
        { path: '/admin/payroll', icon: Banknote, label: 'Payroll', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/pricing', icon: DollarSign, label: 'Pricing', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/manage-proof-of-work', icon: ImageIcon, label: 'Portfolio', roles: ['admin', 'manager', 'ceo'] },
        { path: '/admin/debt-analysis', icon: Activity, label: 'Debt Analysis', roles: ['admin', 'ceo'] },
    ];

    const visibleMenu = menuItems.filter(item => item.roles.includes(viewRole || role));
    const isWorker = (viewRole || role) === 'worker';

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
            {/* Global Search Component */}
            <GlobalSearch />

            {/* Sidebar Overlay for Mobile */}
            <AnimatePresence>
                {isSidebarOpen && window.innerWidth < 1024 && !isWorker && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            {!isWorker && (
                <motion.aside 
                    initial={false}
                    animate={{ width: isSidebarOpen ? 260 : 0 }}
                    className="fixed lg:relative top-0 left-0 h-full bg-[#0f172a] text-white flex flex-col z-50 shrink-0 overflow-hidden border-r border-slate-800/50 shadow-2xl lg:shadow-none"
                >
                    <div className="p-6 flex items-center justify-between shrink-0">
                        <span className="text-xl font-black text-white tracking-tight flex items-center gap-3 whitespace-nowrap">
                            <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
                                <span className="text-white text-base">FT</span>
                            </div>
                            FaroukTech
                        </span>
                        <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white p-1">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="px-4 py-2 shrink-0">
                        <button 
                            onClick={toggleGlobalSearch}
                            className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-800/40 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition border border-slate-700/30 group"
                        >
                            <Search size={16} className="group-hover:text-purple-400 transition" />
                            <span className="text-sm font-medium whitespace-nowrap">Search...</span>
                            <span className="ml-auto text-[9px] font-mono font-bold bg-slate-900 px-1.5 py-0.5 rounded text-slate-600 hidden sm:block">Ctrl K</span>
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                        {visibleMenu.map((item) => (
                            <NavLink 
                                key={item.path} 
                                to={item.path}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group whitespace-nowrap
                                    ${isActive 
                                        ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20' 
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium'
                                    }
                                `}
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'group-hover:text-purple-400'}`} />
                                        <span className="text-sm">{item.label}</span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-800/50 shrink-0">
                        <div className="bg-slate-800/30 rounded-2xl p-3 flex items-center gap-3 mb-4 border border-slate-700/30">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 font-bold text-lg shrink-0">
                                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-white truncate">{user?.name || user?.email || 'User'}</p>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">{viewRole || role}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleLogout} 
                            className="flex items-center gap-3 px-4 py-2.5 w-full text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition text-xs font-bold whitespace-nowrap"
                        >
                            <LogOut size={16} className="shrink-0" />
                            <span>Log Out</span>
                        </button>
                    </div>
                </motion.aside>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Mobile Header - Hide for Worker since Dashboard has its own header */}
                {!isWorker && (
                    <header className="lg:hidden bg-white/80 backdrop-blur-md border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 shrink-0">
                        <button onClick={toggleSidebar} className="p-2 rounded-lg bg-white border border-gray-200 text-slate-600 shadow-sm hover:bg-gray-50 transition">
                            <Menu size={20} />
                        </button>
                        <span className="font-black text-slate-900">Admin</span>
                        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                             {user?.name?.charAt(0) || 'U'}
                        </div>
                    </header>
                )}

                <main className="flex-1 overflow-y-auto bg-slate-50 relative pb-20 lg:pb-0">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="h-full"
                    >
                        <Outlet />
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;