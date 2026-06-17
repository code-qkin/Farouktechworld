import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Wrench, CheckCircle, Clock, BoxSelect, LogOut, 
    Search, X, Box, Briefcase, Layers, Undo2, Lock, Package, AlertTriangle, Bell, ShieldOff, Filter, Palette, Loader2
} from 'lucide-react';
import { useAuth } from '../../AdminContext.jsx';
import { db, auth } from '../../../firebaseConfig.js';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
    collection, updateDoc, doc, 
    runTransaction, setDoc, arrayRemove, serverTimestamp, writeBatch, limit, increment, arrayUnion, addDoc
} from 'firebase/firestore';
import { Toast, ConfirmModal } from '../../Components/Feedback.jsx'; 
import { 
    BarChart, Bar, ResponsiveContainer 
} from 'recharts';
import { useData } from '../../DataContext';

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
  const { user: contextUser, role: contextRole } = useAuth(); 
  const user = propUser || contextUser; 
  const userRole = propUser?.role || contextRole || user?.role || 'worker';
  const navigate = useNavigate();
  
  // Data State
  const [orders, setOrders] = useState([]);
  const { orders: allJobs, inventory, loading: globalLoading } = useData();

  // UI State
  const [activeTab, setActiveTab] = useState('my-jobs'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showPartModal, setShowPartModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 🔥 Added loading state for buttons
  const [showNoPartModal, setShowNoPartModal] = useState(false);
  const [noPartReason, setNoPartReason] = useState('');
  
  // Damage Report State
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageReason, setDamageReason] = useState('');
  
  // Selection State
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedPart, setSelectedPart] = useState('');
  const [partSearch, setPartSearch] = useState(''); 
  const [partCategoryFilter, setPartCategoryFilter] = useState('All'); 
  
  // Device Context
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState(null);
  const [selectedDeviceName, setSelectedDeviceName] = useState('');

  // Feedback
  const [toast, setToast] = useState({ message: '', type: '' });
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null });

  // Notification Logic
  const lastAssignedJobIds = useRef(new Set());
  const isFirstRun = useRef(true);
  const [permissionStatus, setPermissionStatus] = useState(
      (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'denied'
  );

  const isMyJob = (workerName) => {
      if (!workerName) return false;
      const me = (user.name || '').trim().toLowerCase();
      const meEmail = (user.email || '').trim().toLowerCase();
      const w = workerName.trim().toLowerCase();
      return w === me || w === meEmail;
  };

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) {
        setToast({ message: "Notifications not supported on this device", type: "error" });
        return;
    }

    Notification.requestPermission().then((permission) => {
        setPermissionStatus(permission);
        if (permission === 'granted') {
            try { new Notification("Notifications Enabled! 🔔", { body: "You will now receive alerts.", icon: '/vite.svg' }); } 
            catch (e) { console.log(e); }
        }
    });
  };

  useEffect(() => {
    if (!allJobs) return;
    setOrders(allJobs);

    if (user) {
        const myCurrentJobIds = new Set();
        allJobs.forEach(order => {
            if (order.status === 'Void') return;
            const hasMyActiveJob = order.items?.some(item => 
                item.type === 'repair' && 
                item.services?.some(svc => isMyJob(svc.worker) && svc.status !== 'Completed' && svc.status !== 'Void')
            );
            if (hasMyActiveJob) myCurrentJobIds.add(order.id);
        });

        if (!isFirstRun.current) {
            const newJobs = [...myCurrentJobIds].filter(x => !lastAssignedJobIds.current.has(x));
            if (newJobs.length > 0) {
                setToast({ message: `🚀 You have ${newJobs.length} new task(s).`, type: 'info' });
                if ('Notification' in window && Notification.permission === 'granted') {
                     try { new Notification("New Job Assigned 🛠️", { body: "Check your workbench.", icon: '/vite.svg' }); } catch (e) {}
                }
            }
        }
        lastAssignedJobIds.current = myCurrentJobIds;
        isFirstRun.current = false;
    }
  }, [allJobs, user]);

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // --- COMPUTED DATA ---
  const dashboardStats = useMemo(() => {
      let myActive = 0; let poolCount = 0; let myCompleted = 0;
      const chartDataMap = {};
      const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date(); d.setDate(d.getDate() - i);
          return d.toLocaleDateString('en-GB', { weekday: 'short' });
      }).reverse();

      orders.forEach(order => {
          if (!order.items || order.status === 'Void') return;
          const isClosed = order.status === 'Collected';
          order.items.forEach(item => {
              if (item.type === 'repair' && item.services) {
                  item.services.forEach(svc => {
                      if (svc.status === 'Void') return;
                      if (!isClosed && isMyJob(svc.worker) && svc.status !== 'Completed') myActive++;
                      if (!isClosed && (!svc.worker || svc.worker === 'Unassigned')) poolCount++;
                      if (isMyJob(svc.worker) && svc.status === 'Completed') {
                          myCompleted++;
                          const dateObj = svc.completedAt ? new Date(svc.completedAt) : (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
                          const dayKey = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
                          if (new Date() - dateObj < 7 * 24 * 60 * 60 * 1000) chartDataMap[dayKey] = (chartDataMap[dayKey] || 0) + 1;
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
      const hasLoggedPartForDevice = order.items?.some(i => 
          i.type === 'part_usage' && 
          isMyJob(i.worker) && 
          i.targetItemIndex === itemIndex 
      );

      if (!hasLoggedPartForDevice) {
          setToast({ message: "⚠️ Please log a Part (or 'No Part Needed') for this device first.", type: "error" });
          return;
      }

      setConfirmConfig({
          isOpen: true, title: "Complete Task", message: "Mark repair as finished?", confirmText: "Complete", confirmColor: "bg-green-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  newItems[itemIndex].services[serviceIndex].status = 'Completed';
                  newItems[itemIndex].services[serviceIndex].completedAt = new Date().toISOString();
                  const allRepairsDone = newItems.every(item => {
                      if (item.type !== 'repair' || !item.services) return true;
                      return item.services.every(s => s.status === 'Completed' || s.status === 'Void');
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
    if (isSubmitting) return; // 🔥 Prevent duplicate clicks
    if (!selectedPart || selectedDeviceIndex === null) return;
    
    setIsSubmitting(true);
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
                name: `Used: ${part.name} (${selectedDeviceName})`, 
                worker: myIdentity, 
                cost: 0, 
                partId: part.id, 
                category: part.category || 'Uncategorized',
                usedAt: new Date().toISOString(),
                targetItemIndex: selectedDeviceIndex 
            };
            t.update(doc(db, "Orders", selectedTask.id), { items: arrayUnion(usageEntry) });
        });
        
        setShowPartModal(false); setSelectedPart(''); setPartSearch(''); setPartCategoryFilter('All');
        setToast({ message: `Logged usage: ${part.name}`, type: 'success' });
    } catch (e) { 
        setToast({ message: `Error: ${e}`, type: 'error' }); 
    } finally {
        setIsSubmitting(false); // 🔥 Re-enable
    }
  };

  const handleLogNoPart = async () => {
      if (userRole === 'admin' || userRole === 'ceo') {
          if (isSubmitting) return;
          setIsSubmitting(true);
          try {
              const myIdentity = user.name || user.email || "Admin";
              const usageEntry = {
                  type: 'part_usage',
                  name: `Log: No Part Needed (${selectedDeviceName})`,
                  worker: myIdentity,
                  cost: 0,
                  partId: 'no-part-log',
                  usedAt: new Date().toISOString(),
                  targetItemIndex: selectedDeviceIndex
              };
              await updateDoc(doc(db, "Orders", selectedTask.id), { items: arrayUnion(usageEntry) });
              setShowPartModal(false);
              setToast({ message: "No Part Needed logged instantly", type: 'success' });
          } catch (e) {
              setToast({ message: `Error: ${e}`, type: 'error' });
          } finally {
              setIsSubmitting(false);
          }
      } else {
          setShowPartModal(false);
          setShowNoPartModal(true);
      }
  };

  const handleSubmitNoPartRequest = async (e) => {
      e.preventDefault();
      if (!noPartReason.trim() || !selectedTask) return;
      setIsSubmitting(true);
      try {
          const myIdentity = user.name && user.name.trim() !== "" ? user.name : user.email;
          await addDoc(collection(db, "ApprovalRequests"), {
              type: "no_part_needed",
              ticketId: selectedTask.ticketId,
              orderId: selectedTask.id,
              deviceName: selectedDeviceName,
              targetItemIndex: selectedDeviceIndex,
              requestedBy: myIdentity,
              role: user.role || "worker",
              reason: noPartReason.trim(),
              status: "pending",
              requestedAt: serverTimestamp()
          });
          setToast({ message: "Approval request sent to Admin.", type: "success" });
          setShowNoPartModal(false);
          setNoPartReason('');
      } catch (e) {
          setToast({ message: "Failed to send request.", type: "error" });
      }
      setIsSubmitting(false);
  };

  const handleReportDamage = async (e) => {
      e.preventDefault();
      if (!damageReason.trim()) return setToast({ message: "Provide a reason first", type: "error" });
      if (!selectedPart) return setToast({ message: "Select the replacement part", type: "error" });
      setIsSubmitting(true);
      try {
          const part = inventory.find(p => p.id === selectedPart);
          if (!part) throw "Part not found";
          
          const myIdentity = user.name && user.name.trim() !== "" ? user.name : user.email;
          const partRef = doc(db, "Inventory", part.id);
          const incidentData = {
              ticketId: selectedTask.ticketId,
              orderId: selectedTask.id,
              deviceName: selectedDeviceName,
              worker: myIdentity,
              reason: damageReason.trim(),
              partId: part.id,
              partName: part.name,
              partCost: Number(part.price || 0),
              qty: 1,
              timestamp: new Date()
          };

          await runTransaction(db, async (t) => {
              const partDoc = await t.get(partRef);
              if (!partDoc.exists()) throw "Part missing";
              if (partDoc.data().stock < 1) throw "Out of stock";
              t.update(partRef, { stock: increment(-1) });
              const incidentRef = doc(collection(db, "Incidents"));
              t.set(incidentRef, incidentData);
          });

          setToast({ message: "Damage reported. Part deducted from inventory.", type: "success" });
          setShowDamageModal(false);
          setDamageReason('');
          setPartSearch('');
          setSelectedPart('');
      } catch (e) {
          setToast({ message: typeof e === 'string' ? e : "Failed to report damage", type: "error" });
      }
      setIsSubmitting(false);
  };

  const handleUndoPart = (orderId, partItem) => {
      const shouldRestoreStock = partItem.partId && partItem.partId !== 'no-part-log';
      const message = shouldRestoreStock 
        ? `Remove "${partItem.name.replace('Used: ', '')}" from this ticket and restore +1 to stock?`
        : `Remove this log entry?`;

      setConfirmConfig({
          isOpen: true, title: "Undo Part Usage?", message: message, confirmText: "Remove", confirmColor: "bg-red-600",
          action: async () => {
              try {
                  await runTransaction(db, async (t) => {
                      if (shouldRestoreStock) {
                          const partRef = doc(db, "Inventory", partItem.partId);
                          const partDoc = await t.get(partRef);
                          if (partDoc.exists()) { t.update(partRef, { stock: increment(1) }); }
                      }
                      t.update(doc(db, "Orders", orderId), { items: arrayRemove(partItem) });
                  });
                  setToast({ message: "Entry removed", type: "success" });
              } catch (e) { console.error(e); setToast({ message: "Undo failed", type: "error" }); }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  // --- FILTERS & DISPLAY ---
  
  // Extract Unique Categories for Filter
  const categories = useMemo(() => ['All', ...new Set(inventory.map(i => i.category).filter(Boolean))].sort(), [inventory]);

  const filteredInventory = inventory.filter(i => {
      const matchesSearch = i.name.toLowerCase().includes(partSearch.toLowerCase()) || i.model?.toLowerCase().includes(partSearch.toLowerCase());
      const matchesCategory = partCategoryFilter === 'All' || i.category === partCategoryFilter;
      return matchesSearch && matchesCategory;
  });

  const displayOrders = orders.map(order => {
      const matchesSearch = 
        (order.ticketId || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (order.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return null;
      if (order.status === 'Void') return null;
      if ((activeTab === 'pool' || activeTab === 'my-jobs') && order.status === 'Collected') return null;

      const visibleItems = order.items?.map((item, iIdx) => {
          if (item.type !== 'repair' || !item.services) return null;
          const visibleServices = item.services.map((svc, sIdx) => {
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

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-slate-800 pb-20 sm:pb-6">
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} title={confirmConfig.title} message={confirmConfig.message} confirmText={confirmConfig.confirmText} confirmColor={confirmConfig.confirmColor}
        onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})} onConfirm={confirmConfig.action}
      />

      {/* HEADER */}
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
            {permissionStatus === 'default' && typeof window !== 'undefined' && 'Notification' in window && (
                <button onClick={requestNotificationPermission} className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-yellow-200 transition">
                    <Bell size={12}/> Enable Alerts
                </button>
            )}
            <button onClick={handleLogout} className="flex items-center gap-1.5 bg-red-50 border border-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 text-[10px] transition">
                <LogOut size={12} /> Exit
            </button>
        </div>
      </header>

      {/* BODY */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <StatCard title="My Active" value={dashboardStats.myActive} icon={Briefcase} color="purple" />
              <StatCard title="Pool" value={dashboardStats.poolCount} icon={Layers} color="blue" />
              <StatCard title="Completed" value={dashboardStats.myCompleted} icon={CheckCircle} color="green" />
              <div className="hidden sm:block bg-white p-4 rounded-xl border border-gray-200 shadow-sm h-24">
                  <div className="w-full h-full min-h-[40px]"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}><BarChart data={dashboardStats.chartData}><Bar dataKey="done" radius={[2,2,0,0]} fill="#cbd5e1" /></BarChart></ResponsiveContainer></div>
              </div>
          </div>

          {/* MAIN CONTROLS */}
          <div className="flex flex-col gap-3">
              <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex w-full overflow-hidden">
                  <button onClick={() => setActiveTab('my-jobs')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'my-jobs' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Wrench size={14}/> Work ({dashboardStats.myActive})</button>
                  <button onClick={() => setActiveTab('pool')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'pool' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Layers size={14}/> Pool ({dashboardStats.poolCount})</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 rounded-lg ${activeTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><Clock size={14}/> History</button>
              </div>
              <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                  <input className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-purple-500 outline-none text-sm" placeholder="Search ticket or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
          </div>

          {/* LIST */}
          {globalLoading ? (
              <div className="flex justify-center items-center gap-2 py-12 text-purple-600">
                  <Loader2 size={24} className="animate-spin"/> 
                  <span className="font-bold">Loading tasks...</span>
              </div>
          ) : 
           displayOrders.length === 0 ? (
               <div className="bg-white rounded-2xl p-10 text-center border-2 border-dashed border-gray-200 mt-4">
                   <BoxSelect className="text-slate-300 w-12 h-12 mx-auto mb-3"/>
                   <p className="text-slate-500 text-sm font-medium">No jobs found.</p>
               </div>
           ) : (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {displayOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:border-purple-200 transition-all">
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex flex-col">
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded w-fit mb-1">{order.ticketId}</span>
                                <h3 className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{order.customer?.name}</h3>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-full border border-gray-100">{getTimeAgo(order.createdAt)}</span>
                        </div>
                        <div className="p-4 flex-1 space-y-4">
                            {order.visibleItems.map((item, idx) => (
                                <div key={idx} className="relative">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <div className="bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase truncate max-w-[200px]">{item.name || item.deviceModel}</div>
                                        
                                        {item.deviceColor && (
                                            <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-100">
                                                {item.deviceColor}
                                            </div>
                                        )}

                                        {item.passcode && <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100"><Lock size={10} className="text-yellow-600"/><span className="font-mono text-[10px] font-bold text-slate-800">{item.passcode}</span></div>}
                                        {item.condition && <div className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200"><AlertTriangle size={10} className="text-orange-500"/><span className="text-[10px] font-medium text-gray-600 truncate max-w-[150px]">{item.condition}</span></div>}
                                    </div>
                                    <div className="space-y-3 pl-1">
                                        {item.visibleServices.map((svc, sIdxKey) => (
                                            <div key={sIdxKey} className="flex flex-col gap-2 border-l-2 border-gray-100 pl-3 py-1">
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-xs text-slate-700 leading-tight">{svc.service}</span>
                                                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${svc.status === 'Completed' ? 'bg-green-100 text-green-700' : svc.status === 'In Progress' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{svc.status}</span>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    {activeTab === 'pool' && <button onClick={() => claimService(order, item.iIdx, svc.sIdx)} className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition flex items-center justify-center gap-1 active:scale-95">Claim</button>}
                                                    {activeTab === 'my-jobs' && (
                                                        <>
                                                            <button onClick={() => { setSelectedTask(order); setSelectedDeviceIndex(item.iIdx); setSelectedDeviceName(item.name || item.deviceModel); setShowDamageModal(true); }} className="flex-[0.5] py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 flex items-center justify-center" title="Report Spoilt Part"><AlertTriangle size={14}/></button>
                                                            <button onClick={() => { setSelectedTask(order); setSelectedDeviceIndex(item.iIdx); setSelectedDeviceName(item.name || item.deviceModel); setShowPartModal(true); }} className="flex-1 py-2 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100 hover:bg-purple-100 flex items-center justify-center gap-1 active:scale-95"><Box size={14}/> Part</button>
                                                            <button onClick={() => markServiceDone(order, item.iIdx, svc.sIdx)} className="flex-[1.5] py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center justify-center gap-1 active:scale-95"><CheckCircle size={14}/> Done</button>
                                                        </>
                                                    )}
                                                    {activeTab === 'history' && <button onClick={() => undoCompletion(order, item.iIdx, svc.sIdx)} className="w-full py-2 bg-gray-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-gray-200 flex items-center justify-center gap-1 active:scale-95"><Undo2 size={14}/> Undo</button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-dashed border-gray-200 bg-purple-50/30 p-2 rounded-lg">
                                    <div className="flex items-center gap-1.5 mb-2 text-purple-800"><Package size={12} /><p className="text-[10px] font-bold uppercase">Parts Used</p></div>
                                    <div className="space-y-1.5">
                                        {order.items.filter(i => i.type === 'part_usage' && isMyJob(i.worker)).map((part, pIdx) => (
                                            <div key={pIdx} className="flex justify-between items-center bg-white border border-purple-100 px-2 py-1.5 rounded shadow-sm">
                                                <span className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]">{part.name.replace('Used: ', '').replace('Log: ', '')}</span>
                                                <button onClick={() => handleUndoPart(order.id, part)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded" title="Undo"><Undo2 size={12}/></button>
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

      {/* PART MODAL */}
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

                  <div className="mb-3 shrink-0 relative">
                        <select 
                            className="w-full p-2 pl-9 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none"
                            value={partCategoryFilter}
                            onChange={e => setPartCategoryFilter(e.target.value)}
                        >
                            <option value="All">All Categories</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <Filter className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={14}/>
                  </div>

                  <div className="overflow-y-auto flex-1 border rounded-xl bg-gray-50 mb-4 divide-y divide-gray-200 custom-scrollbar">
                      {filteredInventory.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">No parts found</div> : 
                          filteredInventory.map(part => (
                              <button key={part.id} disabled={part.stock < 1} onClick={() => setSelectedPart(part.id)} className={`w-full p-3 text-left text-sm flex justify-between items-center hover:bg-purple-50 transition active:bg-purple-100 ${selectedPart === part.id ? 'bg-purple-100 ring-1 ring-purple-500' : ''}`}>
                                  <div>
                                      <div className={`font-medium ${part.stock < 1 ? 'text-gray-400' : 'text-gray-700'}`}>{part.name}</div>
                                      <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{part.category}</div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${part.stock < 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{part.stock} left</span>
                              </button>
                          ))
                      }
                  </div>

                  <div className="flex gap-2 shrink-0">
                        <button onClick={handleLogNoPart} disabled={isSubmitting} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition flex items-center justify-center gap-1 text-sm disabled:opacity-50">
                            {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <><ShieldOff size={16}/> No Part</>}
                        </button>
                        <button onClick={handleUsePart} disabled={!selectedPart || isSubmitting} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center">
                            {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : "Confirm Usage"}
                        </button>
                  </div>
              </div>
          </div>
      )}

      {/* NO PART REASON MODAL */}
      {showNoPartModal && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white p-5 rounded-2xl shadow-2xl w-full max-w-sm">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><ShieldOff className="text-gray-500"/> Reason Needed</h3>
                      <button onClick={() => setShowNoPartModal(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">Please provide a reason why no part is needed for <b>{selectedDeviceName}</b>. This will be sent to the admin for approval.</p>
                  <form onSubmit={handleSubmitNoPartRequest}>
                      <textarea 
                          className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm mb-4 bg-slate-50" 
                          rows="3" 
                          placeholder="Why is no part needed?..." 
                          value={noPartReason} 
                          onChange={e => setNoPartReason(e.target.value)} 
                          required 
                          autoFocus 
                      />
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setShowNoPartModal(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                          <button type="submit" disabled={isSubmitting} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 shadow-lg transition disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                              {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : "Send Request"}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* DAMAGE REPORT MODAL */}
      {showDamageModal && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white p-5 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-4 shrink-0">
                      <h3 className="font-bold text-lg text-red-600 flex items-center gap-2"><AlertTriangle size={18}/> Report Damage</h3>
                      <button onClick={() => { setShowDamageModal(false); setDamageReason(''); setPartSearch(''); setSelectedPart(''); }} className="bg-gray-100 p-1.5 rounded-full text-gray-500"><X size={18}/></button>
                  </div>
                  
                  <p className="text-sm text-slate-500 mb-3 shrink-0">Report what broke and select the replacement part from inventory.</p>
                  
                  <textarea 
                      className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm mb-3 bg-slate-50 shrink-0" 
                      rows="2" 
                      placeholder="E.g., Screen cracked during repair..." 
                      value={damageReason} 
                      onChange={e => setDamageReason(e.target.value)} 
                      required 
                      autoFocus 
                  />

                  {/* Search */}
                  <div className="relative mb-2 shrink-0">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                      <input className="w-full pl-10 pr-4 py-2 border rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none text-sm" placeholder="Search replacement part..." value={partSearch} onChange={e => setPartSearch(e.target.value)} />
                  </div>

                  <div className="mb-2 shrink-0 relative">
                        <select 
                            className="w-full p-2 pl-9 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-slate-700 outline-none appearance-none"
                            value={partCategoryFilter}
                            onChange={e => setPartCategoryFilter(e.target.value)}
                        >
                            <option value="All">All Categories</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <Filter className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={14}/>
                  </div>

                  {/* List */}
                  <div className="overflow-y-auto flex-1 border rounded-xl bg-gray-50 mb-4 divide-y divide-gray-200 custom-scrollbar min-h-[150px]">
                      {filteredInventory.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">No parts found</div> : 
                          filteredInventory.map(part => (
                              <button key={part.id} disabled={part.stock < 1} onClick={() => setSelectedPart(part.id)} className={`w-full p-2.5 text-left text-sm flex justify-between items-center hover:bg-red-50 transition active:bg-red-100 ${selectedPart === part.id ? 'bg-red-100 ring-1 ring-red-500' : ''}`}>
                                  <div>
                                      <div className={`font-medium text-xs ${part.stock < 1 ? 'text-gray-400' : 'text-gray-700'}`}>{part.name}</div>
                                      <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{part.category}</div>
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${part.stock < 1 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{part.stock} left</span>
                              </button>
                          ))
                      }
                  </div>

                  <div className="flex gap-2 shrink-0">
                      <button onClick={() => { setShowDamageModal(false); setDamageReason(''); setPartSearch(''); setSelectedPart(''); }} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Cancel</button>
                      <button onClick={handleReportDamage} disabled={!selectedPart || !damageReason.trim() || isSubmitting} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2">
                          {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : "Report & Deduct"}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default WorkerDashboard;