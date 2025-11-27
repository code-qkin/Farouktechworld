import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';

// --- 1. TOAST NOTIFICATION ---
export const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  const styles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };

  const Icons = {
    success: CheckCircle,
    error: AlertTriangle,
    info: Info
  };

  const Icon = Icons[type] || Info;

  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border border-l-4 animate-slide-in ${styles[type]} min-w-[300px]`}>
      <Icon size={24} />
      <div className="flex-1 font-medium">{message}</div>
      <button onClick={onClose} className="opacity-50 hover:opacity-100"><X size={18}/></button>
    </div>
  );
};

// --- 2. CONFIRMATION MODAL ---
export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", confirmColor = "bg-purple-600" }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100 animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
          <div className="bg-gray-100 p-3 rounded-full mb-4">
            <HelpCircle size={32} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed whitespace-pre-line">{message}</p>
          
          <div className="flex gap-3 w-full">
            <button 
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg font-semibold shadow-md hover:opacity-90 transition ${confirmColor}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 3. PROMPT MODAL (For Quantity Input) ---
export const PromptModal = ({ isOpen, title, message, max, onConfirm, onCancel }) => {
    const [value, setValue] = useState("1");

    if (!isOpen) return null;

    const handleSubmit = () => {
        const num = parseInt(value);
        if(isNaN(num) || num < 1 || (max && num > max)) return;
        onConfirm(num);
        setValue("1"); // Reset
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in-up">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 text-sm mb-4">{message}</p>
                
                <input 
                    type="number" 
                    autoFocus
                    className="w-full p-3 border-2 border-gray-200 rounded-xl text-xl font-bold text-center mb-6 focus:border-purple-500 outline-none"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    min="1"
                    max={max}
                />

                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100">Cancel</button>
                    <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700">Confirm</button>
                </div>
            </div>
        </div>
    );
};