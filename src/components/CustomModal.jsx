import React from 'react';

export default function CustomModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel', isDark }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`max-w-sm w-full p-6 rounded-2xl shadow-2xl transform transition-all ${isDark ? 'bg-zinc-900 border border-zinc-700 text-white' : 'bg-white text-slate-900'}`}>
        {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
        <div className={`mb-6 text-sm ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>{message}</div>
        <div className="flex justify-end gap-3">
          {onCancel && (
            <button 
              onClick={onCancel} 
              className={`px-4 py-2 rounded font-medium transition ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={onConfirm} 
            className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
