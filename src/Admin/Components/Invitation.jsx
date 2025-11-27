// import React, { useState } from 'react';
// import { UserPlus, Send, AlertCircle, CheckCircle } from 'lucide-react';
// import { sendSignInLinkToEmail } from 'firebase/auth';
// import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
// import { auth, db } from '../../firebaseConfig'; 

// const Invitation = () => {
//     const [newWorker, setNewWorker] = useState({ name: '', email: '', role: 'worker' });
//     const [loading, setLoading] = useState(false);
//     const [message, setMessage] = useState({ type: '', text: '' });

//     const handleInvite = async (e) => {
//         e.preventDefault();
//         setLoading(true);
//         setMessage({ type: '', text: '' });

//         const actionCodeSettings = {
//             // Dynamic URL: Works on localhost AND your live website
//             url: `${window.location.origin}/admin/complete-signup`,
//             handleCodeInApp: true,
//         };

//         try {
//             // 1. Send the Email Link
//             await sendSignInLinkToEmail(auth, newWorker.email, actionCodeSettings);

//             // 2. Create a 'Pending Invite' record in Database
//             // This allows the Signup Page to look up the role later
//             await addDoc(collection(db, "PendingInvites"), {
//                 email: newWorker.email,
//                 name: newWorker.name,
//                 role: newWorker.role, // <--- Important: We save the role here
//                 status: 'Pending',
//                 invitedAt: serverTimestamp(),
//             });

//             // 3. Save locally (Only helps if testing on same PC, harmless otherwise)
//             window.localStorage.setItem('emailForSignIn', newWorker.email);
            
//             setMessage({ type: 'success', text: `Invite sent to ${newWorker.email}` });
//             setNewWorker({ name: '', email: '', role: 'worker' });

//         } catch (error) {
//             console.error("Invite Error:", error);
//             setMessage({ type: 'error', text: error.message });
//         } finally {
//             setLoading(false);
//         }
//     };

//     return (
//         <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-purple-600 mb-8">
//             <h2 className="text-xl font-semibold text-purple-800 mb-4 flex items-center">
//                 <UserPlus className="w-6 h-6 mr-2" /> Invite New Employee
//             </h2>
            
//             {message.text && (
//                 <div className={`p-3 mb-4 rounded text-sm flex items-center ${
//                     message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
//                 }`}>
//                     {message.text}
//                 </div>
//             )}

//             <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-4">
//                 <input 
//                     type="text" placeholder="Full Name" required 
//                     className="p-3 border rounded-lg"
//                     value={newWorker.name} onChange={e => setNewWorker({...newWorker, name: e.target.value})} 
//                 />
//                 <input 
//                     type="email" placeholder="Email Address" required 
//                     className="p-3 border rounded-lg"
//                     value={newWorker.email} onChange={e => setNewWorker({...newWorker, email: e.target.value})} 
//                 />
//                 <select 
//                     className="p-3 border rounded-lg"
//                     value={newWorker.role} onChange={e => setNewWorker({...newWorker, role: e.target.value})}
//                 >
//                     <option value="worker">Worker</option>
//                     <option value="secretary">Secretary</option>
//                     <option value="admin">Admin</option>
//                 </select>
//                 <button disabled={loading} className="bg-purple-700 text-white font-bold rounded-lg flex justify-center items-center">
//                     {loading ? 'Sending...' : <><Send size={18} className="mr-2"/> Send</>}
//                 </button>
//             </form>
//         </div>
//     );
// };

// export default Invitation;