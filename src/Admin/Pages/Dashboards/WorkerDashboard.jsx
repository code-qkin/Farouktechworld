import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wrench, CheckCircle, Clock, BoxSelect, LogOut, 
    Search, X, Box, Briefcase, Layers, Undo2, Lock, Package, AlertTriangle, Bell
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
    BarChart, Bar, ResponsiveContainer 
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
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-24 relative overflow-hidden group">
        <div className="flex justify-between items-start z-10">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <div className={`p-1.5 rounded-lg ${
                color === 'purple' ? 'bg-purple-50 text-purple-600' :
                color === 'blue' ? 'bg-blue-50 text-blue-600' :
                color === 'green' ? 'bg-green-50 text-green-600' :
                'bg-orange-50 text-orange-600'
            }`}>
                <Icon size={16} />
            </div>
        </div>
        <h3 className="text-2xl font-black text-slate-800 z-10">{value}</h3>
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

  // 🔥 Notification Logic
  const lastAssignedJobIds = useRef(new Set());
  const isFirstRun = useRef(true);
  const [permissionStatus, setPermissionStatus] = useState(Notification.permission);

  // --- 🔒 ROBUST OWNERSHIP CHECK ---
  const isMyJob = (workerName) => {
    if (!workerName) return false;
    const assigned = String(workerName).trim().toLowerCase();
    const myName = String(user?.name || '').trim().toLowerCase();
    const myEmail = String(user?.email || '').trim().toLowerCase();
    return assigned === myName || assigned === myEmail;
  };

  // --- REQUEST PERMISSION HANDLER ---
  const requestNotificationPermission = () => {
    Notification.requestPermission().then((permission) => {
        setPermissionStatus(permission);
        if (permission === 'granted') {
            new Notification("Notifications Enabled! 🔔", {
                body: "You will now receive alerts for new repair jobs.",
                icon: '/vite.svg'
            });
        }
    });
  };

  // --- FETCH DATA & HANDLE NOTIFICATIONS ---
  useEffect(() => {
    const unsubInv = onSnapshot(collection(db, "Inventory"), snap => 
        setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubOrders = onSnapshot(query(collection(db, "Orders"), orderBy("createdAt", "desc")), snap => {
        const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setOrders(allJobs);
        setLoading(false);

        // 🔥 NOTIFICATION LOGIC START
        if (user) {
            const myCurrentJobIds = new Set();
            
            allJobs.forEach(order => {
                // Check if this order has any ACTIVE job assigned to me
                // 🔥 Exclude Void Orders/Services
                if (order.status === 'Void') return;

                const hasMyActiveJob = order.items?.some(item => 
                    item.type === 'repair' && 
                    item.services?.some(svc => isMyJob(svc.worker) && svc.status !== 'Completed' && svc.status !== 'Void')
                );
                
                if (hasMyActiveJob) {
                    myCurrentJobIds.add(order.id);
                }
            });

            // If not first run, check for differences (New Assignments)
            if (!isFirstRun.current) {
                // Find IDs that are in 'myCurrent' but NOT in 'lastAssigned'
                const newJobs = [...myCurrentJobIds].filter(x => !lastAssignedJobIds.current.has(x));
                
                if (newJobs.length > 0) {
                    const message = `You have ${newJobs.length} new repair task(s).`;
                    
                    // 1. In-App Toast
                    setToast({ message: `🚀 ${message}`, type: 'info' });

                    // 2. Play Sound
                    try {
                        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                        audio.volume = 1.0;
                        audio.play().catch(e => console.log("Audio blocked:", e));
                    } catch (e) { /* silent fail */ }

                    // 3. System Notification (Status Bar)
                    if (Notification.permission === 'granted') {
                        // Try ServiceWorker method first (Better for mobile)
                        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                            navigator.serviceWorker.ready.then(registration => {
                                registration.showNotification("New Job Assigned 🛠️", {
                                    body: message,
                                    icon: '/vite.svg',
                                    vibrate: [200, 100, 200],
                                    tag: 'new-job'
                                });
                            });
                        } else {
                            // Fallback to standard API
                            new Notification("New Job Assigned 🛠️", { 
                                body: message,
                                icon: '/vite.svg',
                                vibrate: [200, 100, 200]
                            });
                        }
                    }
                }
            }

            // Update refs for next snapshot
            lastAssignedJobIds.current = myCurrentJobIds;
            isFirstRun.current = false;
        }
        // 🔥 NOTIFICATION LOGIC END

    });

    return () => { unsubInv(); unsubOrders(); };
  }, [user]);

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

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
          // 🔥 EXCLUDE VOID ORDERS FROM STATS
          if (order.status === 'Void') return;
          
          const isClosed = order.status === 'Collected';
          
          order.items.forEach(item => {
              if (item.type === 'repair' && item.services) {
                  item.services.forEach(svc => {
                      // 🔥 EXCLUDE VOID SERVICES FROM STATS
                      if (svc.status === 'Void') return;

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
                      return item.services.every(s => s.status === 'Completed' || s.status === 'Void'); // Ignore void services
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
            const usageEntry = { type: 'part_usage', name: `Used: ${part.name}`, worker: myIdentity, cost: 0, partId: part.id, usedAt: new Date().toISOString() };
            t.update(doc(db, "Orders", selectedTask.id), { items: arrayUnion(usageEntry) });
        });
        setShowPartModal(false); setSelectedPart(''); setPartSearch('');
        setToast({ message: `Logged usage: ${part.name}`, type: 'success' });
    } catch (e) { setToast({ message: `Error: ${e}`, type: 'error' }); }
  };

  const handleUndoPart = (orderId, partItem) => {
      setConfirmConfig({
          isOpen: true, title: "Undo Part Usage?", message: `Remove "${partItem.name.replace('Used: ', '')}" from this ticket and restore +1 to stock?`, confirmText: "Restore Stock", confirmColor: "bg-red-600",
          action: async () => {
              try {
                  await runTransaction(db, async (t) => {
                      if (partItem.partId) {
                          const partRef = doc(db, "Inventory", partItem.partId);
                          const partDoc = await t.get(partRef);
                          if (partDoc.exists()) { t.update(partRef, { stock: increment(1) }); }
                      }
                      t.update(doc(db, "Orders", orderId), { items: arrayRemove(partItem) });
                  });
                  setToast({ message: "Part removed & stock restored", type: "success" });
              } catch (e) { console.error(e); setToast({ message: "Undo failed", type: "error" }); }
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

      // 🔥 EXCLUDE VOID ORDERS FROM LIST
      if (order.status === 'Void') return null;

      if ((activeTab === 'pool' || activeTab === 'my-jobs') && order.status === 'Collected') return null;

      const visibleItems = order.items?.map((item, iIdx) => {
          if (item.type !== 'repair' || !item.services) return null;

          const visibleServices = item.services.map((svc, sIdx) => {
              // 🔥 EXCLUDE VOID SERVICES FROM LIST
              if (svc.status === 'Void') return null;

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

  const filteredInventory = inventory.filter(i => 
      i.name.toLowerCase().includes(partSearch.toLowerCase()) || 
      i.model?.toLowerCase().includes(partSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-slate-800 pb-20 sm:pb-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor}
        onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action}
      />

      {/* --- HEADER --- */}
      <header className="bg-white sticky top-0 z-30 px-4 sm:px-6 py-3 border-b border-gray-200 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md">
                <Wrench size={18}/>
            </div>
            <div className="leading-none">
                <h1 className="text-base font-bold text-slate-900">Tech Hub</h1>
                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">{user?.name || user?.email}</p>
            </div>
        </div>

        <div className="flex items-center gap-2">
            {/* 🔥 PERMISSION BUTTON (Only shows if needed) */}
            {permissionStatus === 'default' && (
                <button 
                    onClick={requestNotificationPermission}
                    className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-yellow-200 transition"
                >
                    <Bell size={12}/> Enable Alerts
                </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 text-[10px] transition">
                <LogOut size={12} /> Exit
            </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          
          {/* --- 1. METRICS --- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <StatCard title="My Active" value={dashboardStats.myActive} icon={Briefcase} color="purple" />
              <StatCard title="Pool" value={dashboardStats.poolCount} icon={Layers} color="blue" />
              <StatCard title="Completed" value={dashboardStats.myCompleted} icon={CheckCircle} color="green" />
              
              <div className="hidden sm:block bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-24">
                  <div className="w-full h-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dashboardStats.chartData}>
                              <Bar dataKey="done" radius={[2,2,0,0]} fill="#cbd5e1" />
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>

          {/* --- 2. CONTROLS --- */}
          <div className="flex flex-col gap-3">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex w-full overflow-hidden">
                  <button onClick={() => setActiveTab('my-jobs')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'my-jobs' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Wrench size={14}/> Work ({dashboardStats.myActive})
                  </button>
                  <button onClick={() => setActiveTab('pool')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'pool' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Layers size={14}/> Pool ({dashboardStats.poolCount})
                  </button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <Clock size={14}/> History
                  </button>
              </div>
              
              <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                  <input className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm" placeholder="Search ticket or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          {/* --- 3. TASK GRID --- */}
          {loading ? <div className="text-center py-10 text-slate-400 text-sm">Loading...</div> : 
           displayOrders.length === 0 ? (
               <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 mt-4">
                   <BoxSelect className="text-slate-300 w-12 h-12 mx-auto mb-3"/>
                   <p className="text-slate-500 text-sm font-medium">No jobs found.</p>
               </div>
           ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {displayOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:border-purple-200 transition-all">
                        
                        {/* Card Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex flex-col">
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded w-fit mb-1">{order.ticketId}</span>
                                <h3 className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{order.customer?.name}</h3>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-full border border-gray-100">{getTimeAgo(order.createdAt)}</span>
                        </div>

                        {/* Card Body */}
                        <div className="p-4 flex-1 space-y-4">
                            {order.visibleItems.map((item, idx) => (
                                <div key={idx} className="relative">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <div className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase truncate max-w-[200px]">{item.name || item.deviceModel}</div>
                                        {item.passcode && (
                                            <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100">
                                                <Lock size={10} className="text-yellow-600"/>
                                                <span className="font-mono text-[10px] font-bold text-slate-800">{item.passcode}</span>
                                            </div>
                                        )}
                                        {item.condition && (
                                            <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                                                <AlertTriangle size={10} className="text-orange-500"/>
                                                <span className="text-[10px] font-medium text-gray-600 truncate max-w-[150px]">{item.condition}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3 pl-1">
                                        {item.visibleServices.map((svc, sIdxKey) => (
                                            <div key={sIdxKey} className="flex flex-col gap-2 border-l-2 border-gray-100 pl-3 py-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-xs text-slate-700 leading-tight">{svc.service}</span>
                                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                                        svc.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                                                        svc.status === 'In Progress' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {svc.status}
                                                    </span>
                                                </div>
                                                
                                                {/* ACTION BUTTONS */}
                                                <div className="flex gap-2 mt-1">
                                                    {activeTab === 'pool' && (
                                                        <button onClick={() => claimService(order, item.iIdx, svc.sIdx)} className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition flex items-center justify-center gap-1 active:scale-95">Claim</button>
                                                    )}
                                                    
                                                    {activeTab === 'my-jobs' && (
                                                        <>
                                                            <button onClick={() => { setSelectedTask(order); setShowPartModal(true); }} className="flex-1 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100 hover:bg-purple-100 flex items-center justify-center gap-1 active:scale-95"><Box size={14}/> Part</button>
                                                            <button onClick={() => markServiceDone(order, item.iIdx, svc.sIdx)} className="flex-[1.5] py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-1 active:scale-95"><CheckCircle size={14}/> Done</button>
                                                        </>
                                                    )}

                                                    {activeTab === 'history' && (
                                                        <button onClick={() => undoCompletion(order, item.iIdx, svc.sIdx)} className="w-full py-2 bg-gray-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1 active:scale-95"><Undo2 size={14}/> Undo</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* PARTS USED SECTION */}
                            {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-200 bg-purple-50/30 p-2 rounded-lg">
                                    <div className="flex items-center gap-1.5 mb-2 text-purple-800">
                                        <Package size={12} />
                                        <p className="text-[10px] font-bold uppercase">Parts Used</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).map((part, pIdx) => (
                                            <div key={pIdx} className="flex justify-between items-center bg-white border border-purple-100 px-2 py-1.5 rounded shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{part.name.replace('Used: ', '')}</span>
                                                <button 
                                                    onClick={() => handleUndoPart(order.id, part)}
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded"
                                                    title="Undo & Restore Stock"
                                                >
                                                    <Undo2 size={12}/>
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

      {/* PART MODAL (Existing logic) */}
      {showPartModal && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white p-5 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                      <h3 className="font-bold text-lg text-slate-800">Log Part Usage</h3>
                      <button onClick={() => setShowPartModal(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
                  </div>
                  
                  <div className="relative mb-3 shrink-0">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                      <input autoFocus className="w-full pl-10 pr-4 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm" placeholder="Search part..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
                  </div>

                  <div className="overflow-y-auto flex-1 border rounded-xl bg-gray-50 mb-4 divide-y divide-gray-200">
                      {filteredInventory.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-400">No parts found</div>
                      ) : (
                          filteredInventory.map(part => (
                              <button key={part.id} disabled={part.stock < 1} onClick={() => setSelectedPart(part.id)} className={`w-full p-3 text-left text-sm flex justify-between items-center hover:bg-purple-50 transition active:bg-purple-100 ${selectedPart === part.id ? 'bg-purple-100 ring-1 ring-purple-500' : ''}`}>
                                  <span className={`font-medium ${part.stock < 1 ? 'text-gray-400' : 'text-gray-700'}`}>{part.name}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${part.stock < 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{part.stock} left</span>
                              </button>
                          ))
                      )}
                  </div>

                  <button onClick={handleUsePart} disabled={!selectedPart} className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                      Confirm Usage
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkerDashboard;