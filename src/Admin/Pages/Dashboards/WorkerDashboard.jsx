import React, { useState, useEffect } from 'react';
import { 
    Wrench, CheckCircle, Clock, BoxSelect, LogOut, 
    Search, AlertTriangle, X, Box, Undo2
} from 'lucide-react';
import { useAuth } from '../../AdminContext.jsx';
import { db, auth } from '../../../firebaseConfig.js';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { 
    collection, query, orderBy, onSnapshot, updateDoc, doc, 
    runTransaction, increment, arrayUnion 
} from 'firebase/firestore';
// ✅ Import Custom UI Components
import { Toast, ConfirmModal } from '../../components/Feedback.jsx'; 

const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((new Date() - date) / 1000); 
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

const WorkerDashboard = () => {
  const { user } = useAuth(); 
  const navigate = useNavigate();
  
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('my-jobs'); 
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showPartModal, setShowPartModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedPart, setSelectedPart] = useState('');
  const [issueDescription, setIssueDescription] = useState('');

  // ✅ Feedback States
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

  // --- ACTIONS ---

  const claimService = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true,
          title: "Claim Job",
          message: "Are you sure you want to take this task?",
          confirmText: "Claim",
          confirmColor: "bg-blue-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  newItems[itemIndex].services[serviceIndex].worker = user.name;
                  newItems[itemIndex].services[serviceIndex].status = 'In Progress';
                  
                  await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: 'In Progress' });
                  setActiveTab('my-jobs');
                  setToast({ message: "Job Claimed Successfully!", type: 'success' });
              } catch (e) { 
                  setToast({ message: "Failed to claim job.", type: 'error' }); 
              }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const markServiceDone = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true,
          title: "Complete Task",
          message: "Mark this repair as finished?",
          confirmText: "Complete",
          confirmColor: "bg-green-600",
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
                  
                  setToast({ 
                      message: allRepairsDone ? "Device Ready for Pickup!" : "Task Completed!", 
                      type: 'success' 
                  });
              } catch (e) { 
                  setToast({ message: "Update failed.", type: 'error' }); 
              }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const undoServiceDone = (order, itemIndex, serviceIndex) => {
      setConfirmConfig({
          isOpen: true,
          title: "Undo Completion",
          message: "Move this job back to 'In Progress'?",
          confirmText: "Undo",
          confirmColor: "bg-yellow-600",
          action: async () => {
              try {
                  const newItems = JSON.parse(JSON.stringify(order.items));
                  newItems[itemIndex].services[serviceIndex].status = 'In Progress';
                  await updateDoc(doc(db, "Orders", order.id), { items: newItems, status: 'In Progress' });
                  setActiveTab('my-jobs');
                  setToast({ message: "Job moved back to Workbench.", type: 'info' });
              } catch (e) { 
                  setToast({ message: "Undo failed.", type: 'error' }); 
              }
              setConfirmConfig({ ...confirmConfig, isOpen: false });
          }
      });
  };

  const handleReportIssue = async () => {
      if (!issueDescription || !selectedTask) return setToast({ message: "Please describe the issue.", type: 'error' });
      try {
          await updateDoc(doc(db, "Orders", selectedTask.id), {
              status: 'Issue Reported',
              incidentReport: { reportedBy: user.name, description: issueDescription, date: new Date().toISOString() }
          });
          setShowIssueModal(false); 
          setIssueDescription('');
          setToast({ message: "Issue reported to Admin.", type: 'success' });
      } catch (error) { 
          setToast({ message: "Failed to report issue.", type: 'error' }); 
      }
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
            
            t.update(doc(db, "Orders", selectedTask.id), {
                items: arrayUnion({ 
                    type: 'part_usage', 
                    name: `Used: ${part.name}`, 
                    worker: user.name, 
                    cost: 0, 
                    partId: part.id 
                })
            });
        });
        setShowPartModal(false); 
        setSelectedPart('');
        setToast({ message: `Part deducted: ${part.name}`, type: 'success' });
    } catch (e) { 
        setToast({ message: `Error: ${e}`, type: 'error' }); 
    }
  };

  // --- DISPLAY LOGIC ---
  const displayOrders = orders.map(order => {
      const matchesSearch = order.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return null;

      const visibleItems = order.items?.map((item, iIdx) => {
          if (item.type !== 'repair' || !item.services) return null;

          const visibleServices = item.services.map((svc, sIdx) => {
              const isMine = svc.worker === user.name;
              const isUnassigned = !svc.worker || svc.worker === 'Unassigned';

              if (activeTab === 'my-jobs') return (isMine && svc.status !== 'Completed') ? { ...svc, sIdx } : null;
              if (activeTab === 'pool') return isUnassigned ? { ...svc, sIdx } : null;
              if (activeTab === 'history') return (isMine && svc.status === 'Completed') ? { ...svc, sIdx } : null;
              return null;
          }).filter(Boolean);

          if (visibleServices.length === 0) return null;
          return { ...item, iIdx, visibleServices };
      }).filter(Boolean);

      if (!visibleItems || visibleItems.length === 0) return null;
      if ((activeTab === 'pool' || activeTab === 'my-jobs') && (order.status === 'Collected' || order.status === 'Void' || order.status === 'Ready for Pickup')) return null;

      return { ...order, visibleItems };
  }).filter(Boolean);

  const myCount = orders.filter(t => t.items?.some(i => i.services?.some(s => s.worker === user.name && s.status !== 'Completed'))).length;
  const poolCount = orders.filter(t => t.items?.some(i => i.services?.some(s => !s.worker || s.worker === 'Unassigned'))).length;

  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* ✅ TOAST & MODAL */}
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} 
        title={confirmConfig.title} 
        message={confirmConfig.message} 
        confirmText={confirmConfig.confirmText} 
        confirmColor={confirmConfig.confirmColor}
        onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        onConfirm={confirmConfig.action}
      />

      {/* Header */}
       <header className="bg-white shadow-sm sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg"><Wrench className="text-purple-700" size={24}/></div>
              <div><h1 className="text-xl font-bold text-gray-900">Technician Hub</h1><p className="text-xs text-gray-500">Logged in as <span className="font-bold text-purple-700">{user?.name}</span></p></div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-50 text-sm"><LogOut size={16}/> Sign Out</button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
          
          {/* Tabs & Search */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex bg-white p-1 rounded-lg shadow-sm border w-full md:w-auto">
                  <button onClick={() => setActiveTab('my-jobs')} className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'my-jobs' ? 'bg-purple-100 text-purple-900' : 'text-gray-500 hover:bg-gray-50'}`}>My Workbench ({myCount})</button>
                  <button onClick={() => setActiveTab('pool')} className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'pool' ? 'bg-blue-100 text-blue-900' : 'text-gray-500 hover:bg-gray-50'}`}>Job Pool ({poolCount})</button>
                  <button onClick={() => setActiveTab('history')} className={`flex-1 px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === 'history' ? 'bg-green-100 text-green-900' : 'text-gray-500 hover:bg-gray-50'}`}>History</button>
              </div>
              <div className="relative w-full md:w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16}/><input className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm" placeholder="Search ticket..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </div>

          {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : 
           displayOrders.length === 0 ? (
               <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
                   <p className="text-gray-500">No tasks found in {activeTab}.</p>
               </div>
           ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {displayOrders.map(order => (
                    <div key={order.id} className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition flex flex-col ${order.status === 'In Progress' ? 'border-purple-500 ring-1 ring-purple-100' : 'border-gray-200'}`}>
                        <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                            <div><span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 mb-1">{order.ticketId}</span><h3 className="font-bold text-gray-800 text-sm truncate w-32">{order.customer?.name}</h3></div>
                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">{order.status}</span>
                        </div>
                        <div className="p-4 flex-1 space-y-4">
                            {order.visibleItems.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <div className="text-xs font-bold text-gray-700 uppercase mb-2 border-b pb-1 border-gray-300">{item.name || item.deviceModel}</div>
                                    <div className="space-y-2">
                                        {item.visibleServices.map((svc, sIdxKey) => (
                                            <div key={sIdxKey} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                                                <span className="font-bold text-sm text-gray-900">{svc.service}</span>
                                                
                                                {/* Action Buttons */}
                                                {activeTab === 'pool' && <button onClick={() => claimService(order, item.iIdx, svc.sIdx)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">Claim</button>}
                                                
                                                {activeTab === 'my-jobs' && (
                                                    <div className="flex gap-1">
                                                        <button onClick={() => { setSelectedTask(order); setShowPartModal(true); }} className="bg-gray-100 text-gray-600 px-2 py-1 rounded border hover:bg-gray-200 text-[10px] font-bold" title="Use Part"><Box size={12}/></button>
                                                        <button onClick={() => markServiceDone(order, item.iIdx, svc.sIdx)} className="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-green-700">Done</button>
                                                    </div>
                                                )}
                                                
                                                {activeTab === 'history' && <div className="flex items-center gap-2"><CheckCircle size={14} className="text-green-500"/><button onClick={() => undoServiceDone(order, item.iIdx, svc.sIdx)} className="text-xs text-gray-400 hover:text-red-500" title="Undo"><Undo2 size={14}/></button></div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div className="text-xs text-gray-400 flex gap-2 items-center pt-2 border-t border-dashed"><Clock size={14}/> {getTimeAgo(order.createdAt)}</div>
                        </div>
                        
                        {activeTab === 'my-jobs' && (
                            <div className="p-3 bg-gray-50 rounded-b-xl border-t border-gray-100">
                                <button onClick={() => { setSelectedTask(order); setShowIssueModal(true); }} className="w-full text-xs text-red-500 font-bold hover:underline flex items-center justify-center gap-1">
                                    <AlertTriangle size={12}/> Report Issue
                                </button>
                            </div>
                        )}
                    </div>
                  ))}
              </div>
          )}
      </div>

      {/* PART MODAL */}
      {showPartModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-sm">
                  <h3 className="font-bold text-lg text-purple-900 mb-4">Record Part Usage</h3>
                  <select className="w-full p-3 border rounded-lg bg-gray-50 mb-6" onChange={(e) => setSelectedPart(e.target.value)} value={selectedPart}>
                      <option value="">-- Select Part --</option>
                      {inventory.map(i => <option key={i.id} value={i.id} disabled={i.stock < 1}>{i.name} ({i.stock} Left)</option>)}
                  </select>
                  <div className="flex gap-3">
                      <button onClick={() => setShowPartModal(false)} className="flex-1 border border-gray-300 py-2 rounded-lg font-medium">Cancel</button>
                      <button onClick={handleUsePart} className="flex-1 bg-purple-900 text-white py-2 rounded-lg font-bold">Confirm</button>
                  </div>
              </div>
          </div>
      )}

       {/* ISSUE MODAL */}
       {showIssueModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-red-500">
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-lg text-red-600">Report Incident</h3><button onClick={() => setShowIssueModal(false)}><X/></button></div>
                  <textarea className="w-full p-3 border rounded-lg bg-red-50 min-h-[100px]" placeholder="Describe what happened..." value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)}/>
                  <button onClick={handleReportIssue} className="w-full mt-4 bg-red-600 text-white py-2 rounded-lg font-bold">Flag Order</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkerDashboard;