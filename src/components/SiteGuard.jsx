import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

const SiteGuard = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const SITE_GUARD_PASSWORD = import.meta.env.VITE_SITE_GUARD_PASSWORD

    useEffect(() => {
        // Check if already logged in (saved in browser)
        const session = sessionStorage.getItem('site_access');
        if (session === 'granted') setIsAuthenticated(true);
    }, []);

    const handleUnlock = (e) => {
        e.preventDefault();
        // 🔒 SET YOUR SECRET PASSWORD HERE
        if (password === SITE_GUARD_PASSWORD) { 
            sessionStorage.setItem('site_access', 'granted');
            setIsAuthenticated(true);
        } else {
            alert("Incorrect Access Code");
        }
    };

    if (isAuthenticated) {
        return children; // Render the actual app
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
                <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Lock className="w-8 h-8 text-purple-700" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Site Under Construction</h1>
                <p className="text-gray-500 mb-6">Please enter the access code to view the testing environment.</p>
                
                <form onSubmit={handleUnlock} className="space-y-4">
                    <input 
                        type="password" 
                        placeholder="Access Code"
                        className="w-full p-3 border-2 border-gray-200 rounded-xl text-center text-lg focus:border-purple-600 outline-none transition"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    <button className="w-full bg-purple-700 text-white font-bold py-3 rounded-xl hover:bg-purple-800 transition">
                        Enter Site
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SiteGuard;