import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger' // 'danger' | 'info' | 'warning'
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const colors = {
        danger: {
            bg: 'bg-red-500',
            hover: 'hover:bg-red-600',
            text: 'text-red-400',
            light: 'bg-red-500/10'
        },
        warning: {
            bg: 'bg-yellow-500',
            hover: 'hover:bg-yellow-600',
            text: 'text-yellow-400',
            light: 'bg-yellow-500/10'
        },
        info: {
            bg: 'bg-blue-500',
            hover: 'hover:bg-blue-600',
            text: 'text-blue-400',
            light: 'bg-blue-500/10'
        }
    };

    const activeColor = colors[type] || colors.info;

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 2147483647,
                padding: '1rem', backdropFilter: 'blur(4px)'
            }}
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-md rounded-2xl shadow-2xl relative flex flex-col overflow-hidden"
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${activeColor.light}`}>
                            <AlertTriangle size={20} className={activeColor.text} />
                        </div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">
                            {title}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-gray-300 leading-relaxed">
                        {message}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl border border-gray-700 text-white font-bold hover:bg-white/5 transition-all text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`w-full py-3 rounded-xl ${activeColor.bg} text-white font-bold ${activeColor.hover} transition-all shadow-lg text-sm`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;
