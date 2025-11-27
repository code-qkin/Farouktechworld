import React, { useState, useEffect } from 'react';
import { 
    ClipboardList, ShoppingBag, Search, Package, DollarSign, Clock, 
    CheckCircle, LogOut, Bell, User, Phone, AlertTriangle, ArrowRight, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig'; 
import { signOut } from 'firebase/auth'; 

const formatCurrency = (amount) => `₦${Number(amount).toLocaleString()}`;

const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((new Date() - date) / 1000); 
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const SecretaryDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Data Buckets
  const [stats, setStats] = useState({ cashToday: 0, pendingCount: 0, readyCount: 0 });
  const [pickupList, setPickupList] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let cash = 0;
      let pending = 0;
      let ready = 0;
      
      const allRecent = [];
      const readyItems = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        
        // 1. Financials (Today's Cash)
        if (date >= today) {
            cash += (Number(data.amountPaid) || 0);
        }

        // 2. Counts
        if (data.status === 'Pending' || data.status === 'In Progress') pending++;
        
        // 3. "Ready for Pickup" List (The Priority)
        if (data.status === 'Ready for Pickup' || data.status === 'Completed') {
            ready++;
            if (data.status === 'Ready for Pickup') {
                readyItems.push({ id: doc.id, ...data });
            }
        }

        // 4. Recent List (Limit to 10 for display)
        if (allRecent.length < 10) {
            allRecent.push({ id: doc.id, ...data });
        }
      });

      setStats({ cashToday: cash, pendingCount: pending, readyCount: readyItems.length });
      setPickupList(readyItems);
      setRecentActivity(allRecent);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // Filter Logic
  const filteredPickup = pickupList.filter(o => 
    o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.ticketId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* --- HEADER --- */}
      <header className="bg-white shadow-sm sticky top-0 z-20 px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="bg-purple-100 p-2.5 rounded-xl text-purple-800">
                <User size={24}/>
            </div>
            <div>
                <h1 className="text-xl font-extrabold text-gray-900">Front Desk</h1>
                <p className="text-xs text-gray-500 font-medium">Welcome back, <span className="text-purple-700">{user?.name || 'Secretary'}</span></p>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium text-gray-600">
                <Calendar size={16}/> {new Date().toLocaleDateString()}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-white border border-red-100 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 transition text-sm shadow-sm">
                <LogOut size={16} /> Sign Out
            </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8 space-y-8">

        {/* --- 1. QUICK STATS ROW --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cash Card */}
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white shadow-lg transform hover:scale-[1.02] transition">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-white/20 p-3 rounded-xl"><DollarSign size={24}/></div>
                    <span className="text-xs font-bold bg-green-800/30 px-2 py-1 rounded">TODAY</span>
                </div>
                <p className="text-sm text-green-100 font-medium mb-1">Cash Collected</p>
                <h2 className="text-3xl font-black">{formatCurrency(stats.cashToday)}</h2>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col justify-center gap-3">
                <button onClick={() => navigate('/admin/orders')} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-sm">
                    <ClipboardList size={20}/> New Repair Intake
                </button>
                <button onClick={() => navigate('/admin/orders')} className="w-full bg-blue-50 text-blue-700 border border-blue-100 py-3 rounded-xl font-bold hover:bg-blue-100 transition flex items-center justify-center gap-2">
                    <ShoppingBag size={20}/> Store Sale
                </button>
            </div>

            {/* Pending Card */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-500 font-bold text-sm uppercase">Shop Floor Status</h3>
                    <div className="bg-yellow-100 text-yellow-700 p-2 rounded-lg"><Clock size={20}/></div>
                </div>
                <div className="flex items-end gap-4">
                    <div><span className="text-4xl font-black text-gray-900">{stats.pendingCount}</span><span className="text-sm text-gray-400 block">Jobs Active</span></div>
                    <div className="h-8 w-[1px] bg-gray-200"></div>
                    <div><span className="text-4xl font-black text-purple-600">{stats.readyCount}</span><span className="text-sm text-gray-400 block">Ready for Pickup</span></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* --- 2. LEFT: READY FOR PICKUP (PRIORITY) --- */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[600px]">
                <div className="p-6 border-b bg-white sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                            <Bell className="text-orange-500 fill-orange-500 animate-pulse" size={20}/> Ready for Pickup
                        </h2>
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold">{pickupList.length} Waiting</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Search Customer Name or Ticket ID..." 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
                    {filteredPickup.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                            <CheckCircle size={64} className="mb-4 text-gray-300"/>
                            <p>No orders waiting for pickup.</p>
                        </div>
                    ) : (
                        filteredPickup.map(order => {
                            const balance = order.balance !== undefined ? order.balance : (order.totalCost - (order.amountPaid || 0));
                            return (
                                <div key={order.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-mono font-bold">{order.ticketId}</span>
                                                <h3 className="font-bold text-gray-900">{order.customer.name}</h3>
                                            </div>
                                            <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {order.customer.phone}</p>
                                        </div>
                                        {balance > 0 ? (
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">Balance Due</p>
                                                <p className="text-lg font-black text-red-600">{formatCurrency(balance)}</p>
                                            </div>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={14}/> Paid
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center">
                                        <div className="text-xs text-gray-400">{order.items?.length} Items • {getTimeAgo(order.createdAt)}</div>
                                        <button 
                                            onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition ${balance > 0 ? 'bg-black text-white hover:bg-gray-800' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                        >
                                            {balance > 0 ? 'Collect Payment' : 'Handover'} <ArrowRight size={16}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* --- 3. RIGHT: RECENT ACTIVITY --- */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 h-[600px] flex flex-col">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-gray-400"/> Recent Intake
                </h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                    {recentActivity.map(order => (
                        <div key={order.id} onClick={() => navigate(`/admin/orders/${order.ticketId}`)} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition border border-transparent hover:border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                    order.status === 'Completed' ? 'bg-green-500' : 
                                    order.status === 'Ready for Pickup' ? 'bg-orange-500' :
                                    'bg-blue-500'
                                }`}></div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{order.customer.name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{order.ticketId}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-600">{formatCurrency(order.totalCost)}</p>
                                <p className="text-[10px] text-gray-400">{getTimeAgo(order.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => navigate('/admin/orders')} className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-purple-700 font-bold border-t">View All Activity</button>
            </div>

        </div>
      </div>
    </div>
  );
};

export default SecretaryDashboard;