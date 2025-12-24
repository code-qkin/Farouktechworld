import React, { useState, useEffect, useMemo } from 'react';
import { 
    Wrench, CheckCircle, Clock, BoxSelect, LogOut, 
    Search, X, Box, User, 
    Briefcase, Calendar, TrendingUp, Layers, ArrowRight, Undo2, Lock, Package
} from 'lucide-react';
import { useAuth } from '../../AdminContext.jsx';
import { db, auth } from '../../../firebaseConfig.js';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
    collection, query, orderBy, onSnapshot, updateDoc, doc, 
    runTransaction, increment, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { Toast, ConfirmModal } from '../../Components/Feedback.jsx'; 
import { 
    BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid 
} from 'recharts';

// --- UTILS ---
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
const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex items-center justify-between transition-all hover:shadow-md hover:border-purple-200">
        <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-black text-slate-800">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${
            color === 'purple' ? 'bg-purple-50 text-purple-600' :
            color === 'blue' ? 'bg-blue-50 text-blue-600' :
            color === 'green' ? 'bg-green-50 text-green-600' :
            'bg-orange-50 text-orange-600'
        }`}>
            <Icon size={24} />
        </div>
    </div>
);

const WorkerDashboard = ({ user: propUser }) => {
  const { user: contextUser } = useAuth(); 
  const user = propUser || contextUser; 
  const navigate = useNavigate();
  
  // Data State
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState('my-jobs'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showPartModal, setShowPartModal] = useState(false);
  
  // Selection State
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedPart, setSelectedPart] = useState('');
  const [partSearch, setPartSearch] = useState(''); 

  // Feedback
  const [toast, setToast] = useState({ message: '', type: '' });
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

  // --- FETCH DATA ---
  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, "Inventory"), snap => 
        setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubOrders = onSnapshot(query(collection(db, "Orders"), orderBy("createdAt", "desc")), snap => {
        const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(allJobs);
        setLoading(false);
    });

    return () => { unsubInv(); unsubOrders(); };
  }, []);

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // --- 🔒 ROBUST OWNERSHIP CHECK ---
  const isMyJob = (workerName) => {
      if (!workerName) return false;
      const assigned = String(workerName).trim().toLowerCase();
      const myName = String(user?.name || '').trim().toLowerCase();
      const myEmail = String(user?.email || '').trim().toLowerCase();
      return assigned === myName || assigned === myEmail;
  };

  // --- COMPUTED DATA ---
  const dashboardStats = useMemo(() => {
      let myActive = 0;
      let poolCount = 0;
      let myCompleted = 0;
      const chartDataMap = {};
      const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date(); d.setDate(d.getDate() - i);
          return d.toLocaleDateString('en-GB', { weekday: 'short' });
      }).reverse();

      orders.forEach(order => {
          if (!order.items) return;
          
          const isClosed = order.status === 'Collected' || order.status === 'Void';
          
          order.items.forEach(item => {
              if (item.type === 'repair' && item.services) {
                  item.services.forEach(svc => {
                      if (!isClosed && isMyJob(svc.worker) && svc.status !== 'Completed') myActive++;
                      if (!isClosed && (!svc.worker || svc.worker === 'Unassigned')) poolCount++;
                      
                      if (isMyJob(svc.worker) && svc.status === 'Completed') {
                          myCompleted++;
                          const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
                          const dayKey = date.toLocaleDateString('en-GB', { weekday: 'short' });
                          if (new Date() - date < 7 * 24 * 60 * 60 * 1000) {
                              chartDataMap[dayKey] = (chartDataMap[dayKey] || 0) + 1;
                          }
                      }
                  });
              }
          });
      });

      const chartData = last7Days.map(day => ({ name: day, done: chartDataMap[day] || 0 }));
      return { myActive, poolCount, myCompleted, chartData };
  }, [orders, user]);

  // --- ACTIONS ---
  
  const claimService = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true, title: "Claim Job", message: "Add this task to your workbench?", confirmText: "Claim Job", confirmColor: "bg-blue-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  const myIdentity = user.name && user.name.trim() !== "" ? user.name : user.email;
                  newItems[itemIndex].services[serviceIndex].worker = myIdentity; 
                  newItems[itemIndex].services[serviceIndex].status = 'In Progress';
                  await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: 'In Progress' });
                  setActiveTab('my-jobs');
                  setToast({ message: "Job Claimed!", type: 'success' });
              } catch (e) { setToast({ message: "Failed to claim.", type: 'error' }); }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const markServiceDone = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true, title: "Complete Task", message: "Mark repair as finished?", confirmText: "Complete", confirmColor: "bg-green-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  newItems[itemIndex].services[serviceIndex].status = 'Completed';
                  const allRepairsDone = newItems.every(item => {
                      if (item.type !== 'repair' || !item.services) return true;
                      return item.services.every(s => s.status === 'Completed');
                  });
                  const newStatus = allRepairsDone ? 'Ready for Pickup' : 'In Progress';
                  await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: newStatus });
                  setToast({ message: "Task Completed!", type: 'success' });
              } catch (e) { setToast({ message: "Update failed.", type: 'error' }); }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const undoCompletion = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true, title: "Undo Completion", message: "Move this task back to your workbench?", confirmText: "Undo", confirmColor: "bg-slate-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  newItems[itemIndex].services[serviceIndex].status = 'In Progress';
                  
                  // Reset main order status if needed
                  await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: 'In Progress' });
                  
                  setToast({ message: "Task moved to Workbench", type: 'success' });
                  setActiveTab('my-jobs');
              } catch (e) { setToast({ message: "Update failed.", type: 'error' }); }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const handleUsePart = async () => {
    if (!selectedPart) return;
    const part = inventory.find(i => i.id === selectedPart);
    try {
        await runTransaction(db, async (t) => {
            const partRef = doc(db, "Inventory", selectedPart);
            const partDoc = await t.get(partRef);
            if (partDoc.data().stock < 1) throw "Out of Stock!";
            
            t.update(partRef, { stock: increment(-1) });
            
            const myIdentity = user.name || user.email || "Technician";
            
            const usageEntry = { 
                type: 'part_usage', 
                name: `Used: ${part.name}`, 
                worker: myIdentity, 
                cost: 0, 
                partId: part.id,
                usedAt: new Date().toISOString() 
            };

            t.update(doc(db, "Orders", selectedTask.id), {
                items: arrayUnion(usageEntry)
            });
        });
        setShowPartModal(false); setSelectedPart(''); setPartSearch('');
        setToast({ message: `Logged usage: ${part.name}`, type: 'success' });
    } catch (e) { setToast({ message: `Error: ${e}`, type: 'error' }); }
  };

  // 🔥 UPDATED: Replaced window.confirm with ConfirmModal
  const handleUndoPart = (orderId, partItem) => {
      setConfirmConfig({
          isOpen: true,
          title: "Undo Part Usage?",
          message: `Remove "${partItem.name.replace('Used: ', '')}" from this ticket and restore +1 to stock?`,
          confirmText: "Restore Stock",
          confirmColor: "bg-red-600",
          action: async () => {
              try {
                  await runTransaction(db, async (t) => {
                      // 1. Restore Stock
                      if (partItem.partId) {
                          const partRef = doc(db, "Inventory", partItem.partId);
                          const partDoc = await t.get(partRef);
                          if (partDoc.exists()) {
                              t.update(partRef, { stock: increment(1) });
                          }
                      }

                      // 2. Remove from Order
                      const orderRef = doc(db, "Orders", orderId);
                      t.update(orderRef, {
                          items: arrayRemove(partItem)
                      });
                  });
                  setToast({ message: "Part removed & stock restored", type: "success" });
              } catch (e) {
                  console.error(e);
                  setToast({ message: "Undo failed", type: "error" });
              }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  // --- DISPLAY LOGIC ---
  const displayOrders = orders.map(order => {
      const matchesSearch = 
        order.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return null;

      if ((activeTab === 'pool' || activeTab === 'my-jobs') && (order.status === 'Collected' || order.status === 'Void')) return null;

      const visibleItems = order.items?.map((item, iIdx) => {
          if (item.type !== 'repair' || !item.services) return null;

          const visibleServices = item.services.map((svc, sIdx) => {
              const mine = isMyJob(svc.worker);
              const isUnassigned = !svc.worker || svc.worker === 'Unassigned';

              if (activeTab === 'my-jobs') return (mine && svc.status !== 'Completed') ? { ...svc, sIdx } : null;
              if (activeTab === 'pool') return isUnassigned ? { ...svc, sIdx } : null;
              if (activeTab === 'history') return (mine && svc.status === 'Completed') ? { ...svc, sIdx } : null;
              return null;
          }).filter(Boolean);

          if (visibleServices.length === 0) return null;
          return { ...item, iIdx, visibleServices };
      }).filter(Boolean);

      if (!visibleItems || visibleItems.length === 0) return null;
      return { ...order, visibleItems };
  }).filter(Boolean);

  // Filter Parts for Modal
  const filteredInventory = inventory.filter(i => 
      i.name.toLowerCase().includes(partSearch.toLowerCase()) || 
      i.model?.toLowerCase().includes(partSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-slate-800">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor}
        onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action}
      />

      {/* --- HEADER --- */}
      <header className="bg-white sticky top-0 z-30 px-6 py-4 border-b border-gray-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200">
                <Wrench size={20}/>
            </div>
            <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Technician Hub</h1>
                <p className="text-xs text-slate-500 font-medium">Logged in as: <span className="text-blue-700 font-bold">{user?.name || user?.email}</span></p>
            </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 text-xs transition">
            <LogOut size={14} /> Sign Out
        </button>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
          
          {/* --- 1. METRICS --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard title="My Active Jobs" value={dashboardStats.myActive} icon={Briefcase} color="purple" />
                  <StatCard title="Available in Pool" value={dashboardStats.poolCount} icon={Layers} color="blue" />
                  <StatCard title="Total Completed" value={dashboardStats.myCompleted} icon={CheckCircle} color="green" />
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm h-36 flex flex-col relative overflow-hidden">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2 z-10"><TrendingUp size={14}/> Weekly Activity</h3>
                  <div className="flex-1 w-full min-h-0 z-10">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardStats.chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10, fill:'#94a3b8'}} dy={5}/>
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'8px', border:'none', fontSize:'12px'}}/>
                              <Bar dataKey="done" radius={[4,4,0,0]} barSize={20} fill="#22c55e" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          {/* --- 2. CONTROLS --- */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full sm:w-auto">
                  <button onClick={() => setActiveTab('my-jobs')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'my-jobs' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Wrench size={16}/> Workbench <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'my-jobs' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{dashboardStats.myActive}</span>
                  </button>
                  <button onClick={() => setActiveTab('pool')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'pool' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Layers size={16}/> Job Pool <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'pool' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{dashboardStats.poolCount}</span>
                  </button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-green-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Clock size={16}/> History
                  </button>
              </div>
              <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18}/>
                  <input className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm shadow-sm" placeholder="Search ticket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          {/* --- 3. TASK GRID --- */}
          {loading ? <div className="text-center py-20 text-slate-400">Loading workspace...</div> : 
           displayOrders.length === 0 ? (
               <div className="bg-white rounded-2xl p-16 text-center border-2 border-dashed border-gray-200">
                   <BoxSelect className="text-slate-400 w-20 h-20 mx-auto mb-4"/>
                   <h3 className="text-slate-900 font-bold text-lg mb-1">Clean Workbench</h3>
                   <p className="text-slate-500 text-sm mb-6">{activeTab === 'my-jobs' ? `You have no pending repairs.` : "No new jobs available in the pool."}</p>
                   {activeTab === 'my-jobs' && <button onClick={() => setActiveTab('pool')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-lg">Check Job Pool</button>}
               </div>
           ) : (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {displayOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-all group">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex justify-between items-start bg-slate-50/80">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs font-bold bg-white border border-gray-200 px-2 py-0.5 rounded text-slate-600">{order.ticketId}</span>
                                    <span className="text-xs text-slate-400">{getTimeAgo(order.createdAt)}</span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2"><User size={14} className="text-slate-400"/> {order.customer?.name}</h3>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-4 flex-1 space-y-4">
                            {order.visibleItems.map((item, idx) => (
                                <div key={idx} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm relative">
                                    <div className="absolute -top-3 left-3 bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">{item.name || item.deviceModel}</div>
                                    
                                    {/* SHOW PASSCODE */}
                                    {item.passcode && (
                                        <div className="mt-3 mb-2 flex items-center gap-2 bg-yellow-50 px-2 py-1.5 rounded-lg border border-yellow-100">
                                            <Lock size={12} className="text-yellow-600"/>
                                            <span className="text-xs font-bold text-yellow-800">Passcode:</span>
                                            <span className="font-mono text-sm font-bold text-slate-800">{item.passcode}</span>
                                        </div>
                                    )}

                                    <div className={item.passcode ? "mt-2 space-y-3" : "mt-3 space-y-3"}>
                                        {item.visibleServices.map((svc, sIdxKey) => (
                                            <div key={sIdxKey} className="flex flex-col gap-2 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-sm text-slate-700">{svc.service}</span>
                                                    {/* SERVICE STATUS BADGE */}
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                                        svc.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                                        svc.status === 'In Progress' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {svc.status}
                                                    </span>
                                                </div>
                                                
                                                {/* ACTIONS */}
                                                <div className="flex justify-end gap-2 flex-wrap">
                                                    {activeTab === 'pool' && (
                                                        <button onClick={() => claimService(order, item.iIdx, svc.sIdx)} className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition flex items-center justify-center gap-2">Claim Job <ArrowRight size={14}/></button>
                                                    )}
                                                    
                                                    {activeTab === 'my-jobs' && (
                                                        <>
                                                            <button onClick={() => { setSelectedTask(order); setShowPartModal(true); }} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 hover:bg-purple-100 text-xs font-bold flex items-center gap-1"><Box size={14}/> Part</button>
                                                            <button onClick={() => markServiceDone(order, item.iIdx, svc.sIdx)} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center gap-1"><CheckCircle size={14}/> Done</button>
                                                        </>
                                                    )}

                                                    {/* UNDO BUTTON (History Tab) */}
                                                    {activeTab === 'history' && (
                                                        <button 
                                                            onClick={() => undoCompletion(order, item.iIdx, svc.sIdx)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-gray-50 hover:text-slate-700 transition shadow-sm w-full justify-center"
                                                        >
                                                            <Undo2 size={12}/> Undo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* 🔥 PARTS USED SECTION (Per Order) */}
                            {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).length > 0 && (
                                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 bg-purple-50/50 p-3 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2 text-purple-800">
                                        <Package size={14} />
                                        <p className="text-[10px] font-bold uppercase tracking-wider">Parts Used</p>
                                    </div>
                                    <div className="space-y-2">
                                        {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).map((part, pIdx) => (
                                            <div key={pIdx} className="flex justify-between items-center bg-white border border-purple-100 p-2 rounded-lg shadow-sm">
                                                <span className="text-xs font-semibold text-slate-700">{part.name.replace('Used: ', '')}</span>
                                                <button 
                                                    onClick={() => handleUndoPart(order.id, part)}
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                                                    title="Undo (Restores Stock)"
                                                >
                                                    <Undo2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                  ))}
              </div>
          )}
      </div>

      {/* PART MODAL (Searchable) */}
      {showPartModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800">Log Part Usage</h3>
                      <button onClick={() => setShowPartModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                  </div>
                  
                  {/* Search Box */}
                  <div className="relative mb-4">
                      <Search className="absolute left-3 top-3 text-gray-400" size={16}/>
                      <input 
                        autoFocus
                        className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm" 
                        placeholder="Search part (e.g. Screen 13 Pro)..."
                        value={partSearch}
                        onChange={e => setPartSearch(e.target.value)}
                      />
                  </div>

                  {/* Scrollable List */}
                  <div className="max-h-60 overflow-y-auto border rounded-xl bg-gray-50 mb-4 divide-y divide-gray-200">
                      {filteredInventory.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400">No parts found matching "{partSearch}"</div>
                      ) : (
                          filteredInventory.map(part => (
                              <button 
                                key={part.id} 
                                disabled={part.stock < 1}
                                onClick={() => setSelectedPart(part.id)}
                                className={`w-full p-3 text-left text-sm flex justify-between items-center hover:bg-purple-50 transition ${selectedPart === part.id ? 'bg-purple-100 ring-1 ring-purple-500 z-10' : ''}`}
                              >
                                  <span className={`font-medium ${part.stock < 1 ? 'text-gray-400' : 'text-gray-700'}`}>{part.name}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded ${part.stock < 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{part.stock} left</span>
                              </button>
                          ))
                      )}
                  </div>

                  <button onClick={handleUsePart} disabled={!selectedPart} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
                      Confirm Usage
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkerDashboard;