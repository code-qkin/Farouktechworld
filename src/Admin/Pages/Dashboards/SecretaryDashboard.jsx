import React, { useState, useEffect, useMemo } from 'react';
import { 
    ClipboardList, ShoppingBag, Search, DollarSign, Clock, 
    CheckCircle, LogOut, Bell, User, Phone, Calendar, 
    ArrowRight, TrendingUp, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../firebaseConfig'; 
import { signOut } from 'firebase/auth'; 
import { 
    BarChart, Bar, XAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

// --- UTILS ---
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

// --- COMPONENTS ---
const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between transition-all hover:shadow-md h-full">
        <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-2xl font-black text-gray-900">{value}</h3>
            {subtext && <p className={`text-xs mt-1 font-medium ${
                color === 'green' ? 'text-green-600' : 
                color === 'indigo' ? 'text-indigo-600' :
                color === 'orange' ? 'text-orange-600' :
                color === 'purple' ? 'text-purple-600' :
                'text-blue-600'
            }`}>{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${
            color === 'purple' ? 'bg-purple-50 text-purple-600' :
            color === 'green' ? 'bg-green-50 text-green-600' :
            color === 'orange' ? 'bg-orange-50 text-orange-600' :
            color === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
            'bg-blue-50 text-blue-600'
        }`}>
            <Icon size={22} />
        </div>
    </div>
);

const SecretaryDashboard = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Data
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Live Data Fetch
  useEffect(() => {
    const q = query(collection(db, "Orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // 2. Computed Metrics (Memoized)
  const dashboardData = useMemo(() => {
      const today = new Date();
      today.setHours(0,0,0,0);

      let cashToday = 0;
      let activeJobs = 0;
      const readyForPickup = [];
      const recentIntake = [];
      
      // Chart Data Helpers
      const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date(); d.setDate(d.getDate() - i);
          return d.toLocaleDateString('en-GB', { weekday: 'short' });
      }).reverse();
      const intakeCounts = {};

      orders.forEach(order => {
          const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
          const dayKey = orderDate.toLocaleDateString('en-GB', { weekday: 'short' });

          // A. Financials
          if (orderDate >= today) cashToday += (Number(order.amountPaid) || 0);

          // B. Status Buckets
          if (['Pending', 'In Progress'].includes(order.status)) activeJobs++;
          
          if (order.status === 'Ready for Pickup') {
              readyForPickup.push(order);
          }

          // C. Recent List (All non-completed/collected or recent)
          if (recentIntake.length < 8) {
              recentIntake.push(order);
          }

          // D. Chart Data Populating (Intake)
          if (new Date() - orderDate < 7 * 24 * 60 * 60 * 1000) {
              intakeCounts[dayKey] = (intakeCounts[dayKey] || 0) + 1;
          }
      });

      const chartData = last7Days.map(day => ({
          name: day,
          intake: intakeCounts[day] || 0
      }));

      return { 
          cashToday, 
          activeJobs, 
          readyForPickup, 
          recentIntake, 
          chartData,
          totalOrders: orders.length // 🔥 New Metric: Total Orders
      };
  }, [orders]);

  // 3. Search Logic
  const filteredReadyList = dashboardData.readyForPickup.filter(o => 
    o.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.ticketId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-slate-800">
      
      {/* --- HEADER --- */}
      <header className="bg-white sticky top-0 z-30 px-6 py-4 border-b border-gray-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="bg-purple-600 p-2 rounded-lg text-white shadow-lg shadow-purple-200">
                <User size={20}/>
            </div>
            <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Front Desk</h1>
                <p className="text-xs text-slate-500 font-medium">Operator: <span className="text-purple-700">{user?.name || 'Staff'}</span></p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 border border-slate-200">
                <Calendar size={14}/> {new Date().toLocaleDateString()}
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 text-xs transition">
                <LogOut size={14} /> Sign Out
            </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* --- 1. METRICS ROW --- */}
        {/* Updated grid to xl:grid-cols-5 to fit the new card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            
            {/* 🔥 NEW CARD: All Time Orders */}
            <StatCard 
                title="All Time Orders" 
                value={dashboardData.totalOrders} 
                icon={Layers} 
                color="indigo" 
                subtext="Total Lifetime Volume" 
            />

            <StatCard title="Cash Collected (Today)" value={formatCurrency(dashboardData.cashToday)} icon={DollarSign} color="green" subtext="Daily Revenue" />
            <StatCard title="Ready for Pickup" value={dashboardData.readyForPickup.length} icon={Bell} color="orange" subtext="Awaiting Customer" />
            <StatCard title="Active Jobs" value={dashboardData.activeJobs} icon={Clock} color="blue" subtext="In Workshop" />
            <StatCard title="Total Intake (7 Days)" value={dashboardData.chartData.reduce((a,b)=>a+b.intake,0)} icon={ClipboardList} color="purple" subtext="Weekly Volume" />
        </div>

        {/* --- 2. MAIN SPLIT --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT: ACTIONS & PICKUP LIST */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Quick Actions Bar - REMOVED CHECK INVENTORY */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
                    <button onClick={() => navigate('/admin/orders')} className="flex-1 w-full bg-purple-900 text-white h-12 rounded-lg font-bold hover:bg-purple-800 transition flex items-center justify-center gap-2 shadow-md">
                        <ClipboardList size={18}/> New Repair Order
                    </button>
                    {/* Inventory Button Removed Here */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={16}/>
                        <input 
                            placeholder="Find Ticket ID..." 
                            className="w-full pl-10 h-12 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Ready for Pickup Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <CheckCircle size={18} className="text-orange-500"/> Ready for Collection
                        </h3>
                        <span className="bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full text-xs font-bold">{dashboardData.readyForPickup.length}</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {filteredReadyList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <ShoppingBag size={48} className="mb-3 opacity-20"/>
                                <p className="text-sm">No items waiting for pickup.</p>
                            </div>
                        ) : (
                            filteredReadyList.map(order => {
                                const balance = order.balance || (order.totalCost - (order.amountPaid || 0));
                                return (
                                    <div key={order.id} className="group bg-white p-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">{order.ticketId}</span>
                                                    <span className="text-xs text-gray-400">{getTimeAgo(order.createdAt)}</span>
                                                </div>
                                                <h4 className="font-bold text-slate-900 mt-1">{order.customer.name}</h4>
                                            </div>
                                            {balance > 0 ? (
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded uppercase">Unpaid</span>
                                                    <p className="font-black text-red-600 mt-1">{formatCurrency(balance)}</p>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded uppercase flex items-center gap-1">
                                                    <CheckCircle size={10}/> Paid
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-dashed border-gray-100">
                                            <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={12}/> {order.customer.phone}</span>
                                            <button 
                                                onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                                className={`text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition ${balance > 0 ? 'bg-slate-900 text-white hover:bg-black' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                                            >
                                                {balance > 0 ? 'Collect Payment' : 'Handover'} <ArrowRight size={12}/>
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT: CHART & RECENT INTAKE */}
            <div className="space-y-6">
                
                {/* Mini Chart Card */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-64 flex flex-col">
                    <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-purple-600"/> Weekly Intake
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10, fill:'#94a3b8'}} dy={10}/>
                                <Tooltip 
                                    cursor={{fill: '#f8fafc'}}
                                    contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}
                                />
                                <Bar dataKey="intake" radius={[4,4,0,0]}>
                                    {dashboardData.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === new Date().toLocaleDateString('en-GB', {weekday:'short'}) ? '#9333ea' : '#cbd5e1'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Activity List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[380px] flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-slate-800 text-sm">Recent Activity</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {dashboardData.recentIntake.map(order => (
                            <div 
                                key={order.id} 
                                onClick={() => navigate(`/admin/orders/${order.ticketId}`)}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition group"
                            >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                    order.status === 'Completed' ? 'bg-green-500' :
                                    order.status === 'Ready for Pickup' ? 'bg-orange-500' : 
                                    'bg-blue-500'
                                }`}/>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-700 truncate">{order.customer.name}</p>
                                    <p className="text-xs text-slate-400 flex items-center gap-1">
                                        {order.orderType === 'repair' ? <WrenchIcon/> : <BagIcon/>} 
                                        {order.ticketId}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-600">{formatCurrency(order.totalCost)}</p>
                                    <p className="text-[10px] text-slate-400">{getTimeAgo(order.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => navigate('/admin/orders')} className="p-3 text-xs font-bold text-center text-purple-600 hover:bg-purple-50 border-t transition">
                        View Full History
                    </button>
                </div>

            </div>
        </div>
      </main>
    </div>
  );
};

// Mini Icons for list
const WrenchIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>;
const BagIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z" /></svg>;

export default SecretaryDashboard;