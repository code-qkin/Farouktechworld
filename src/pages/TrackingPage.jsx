import React, { useState } from 'react';
import { Search, AlertCircle, CheckCircle, Clock, Truck, Package } from 'lucide-react';
import { db } from '../firebaseConfig'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
// ✅ Correct Import for Toast
import { Toast } from '../Admin/Components/Feedback'; 

const TrackingPage = () => {
    const [ticketNumber, setTicketNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [orderStatus, setOrderStatus] = useState(null);
    
    // Feedback State
    const [toast, setToast] = useState({ message: '', type: '' });

    const handleTrack = async (e) => {
        e.preventDefault();
        setOrderStatus(null);
        setLoading(true);

        const normalizedTicket = ticketNumber.trim().toUpperCase();

        if (!normalizedTicket) {
            setToast({ message: "Please enter a Ticket ID", type: "error" });
            setLoading(false);
            return;
        }

        try {
            // Query Firestore for the Ticket ID
            const q = query(collection(db, "Orders"), where("ticketId", "==", normalizedTicket));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const data = querySnapshot.docs[0].data();
                
                // Format Items List for Display
                const itemsDisplay = data.items?.map(i => i.name || i.deviceModel).join(', ') || 'Device Repair';
                
                // Privacy: Mask Customer Name (e.g., "John Doe" -> "John ***")
                const customerName = data.customer?.name ? `${data.customer.name.split(' ')[0]} ***` : "Customer";

                setOrderStatus({
                    ticketId: data.ticketId,
                    status: data.status,
                    paymentStatus: data.paymentStatus || (data.paid ? 'Paid' : 'Unpaid'),
                    items: itemsDisplay,
                    customer: customerName,
                    date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Recent'
                });
                setToast({ message: "Order Found!", type: "success" });
            } else {
                setToast({ message: "Ticket not found. Please check the ID.", type: "error" });
            }

        } catch (err) {
            console.error("Tracking Error:", err);
            setToast({ message: "System error. Please try again.", type: "error" });
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <section className="bg-gradient-to-b from-purple-50 to-white py-24 min-h-screen px-4 flex flex-col items-center">
            
            {/* Feedback Toast */}
            <Toast message={toast.message} type={toast.type} onClose={() => setToast({message:'', type:''})} />

            <div className="max-w-xl w-full text-center">
                <h1 className="text-4xl font-extrabold text-purple-900 mb-4">Track Your Repair</h1>
                <p className="text-gray-600 mb-8">Enter your Ticket ID (e.g., FTW-2024...) to check the live status of your device.</p>

                <form onSubmit={handleTrack} className="relative mb-12 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="text-gray-400 group-focus-within:text-purple-600 transition" />
                    </div>
                    <input
                        type="text"
                        value={ticketNumber}
                        onChange={(e) => setTicketNumber(e.target.value)}
                        placeholder="Enter Ticket ID"
                        className="w-full pl-12 pr-32 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition text-lg font-mono uppercase shadow-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="absolute right-2 top-2 bottom-2 bg-purple-700 text-white px-6 rounded-xl font-bold hover:bg-purple-800 transition disabled:opacity-70 flex items-center gap-2"
                    >
                        {loading ? 'Checking...' : 'Track'}
                    </button>
                </form>

                {/* ORDER STATUS CARD */}
                {orderStatus && (
                    <div className="bg-white text-left rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up transform transition-all">
                        {/* Status Banner */}
                        <div className={`p-6 flex justify-between items-center ${
                             orderStatus.status === 'Completed' ? 'bg-green-600' : 
                             orderStatus.status === 'Ready for Pickup' ? 'bg-indigo-600' :
                             orderStatus.status === 'Collected' ? 'bg-gray-800' :
                             'bg-yellow-500'
                        } text-white`}>
                            <div>
                                <p className="text-xs font-bold opacity-80 uppercase tracking-wider">Current Status</p>
                                <h2 className="text-2xl font-black uppercase">{orderStatus.status}</h2>
                            </div>
                            <div className="bg-white/20 p-3 rounded-full">
                                {orderStatus.status === 'Completed' ? <CheckCircle size={28}/> : 
                                 orderStatus.status === 'Ready for Pickup' ? <Truck size={28}/> : 
                                 <Clock size={28}/>}
                            </div>
                        </div>

                        {/* Details Body */}
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between border-b border-gray-100 pb-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Ticket ID</p>
                                    <p className="text-lg font-mono font-bold text-purple-900">{orderStatus.ticketId}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Date</p>
                                    <p className="text-gray-700 font-medium">{orderStatus.date}</p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold mb-2">Device / Items</p>
                                <div className="flex items-start gap-3 bg-purple-50 p-3 rounded-lg">
                                    <Package className="text-purple-600 mt-1" size={18}/>
                                    <p className="text-gray-800 font-medium">{orderStatus.items}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${orderStatus.paymentStatus === 'Paid' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                    <span className="text-sm text-gray-600 font-medium">Payment: <span className="font-bold text-gray-900">{orderStatus.paymentStatus}</span></span>
                                </div>
                                <span className="text-xs text-gray-400 italic">Owned by {orderStatus.customer}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default TrackingPage;