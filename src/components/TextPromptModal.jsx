import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Ask for one line of text.
 *
 * Exists because Electron does not implement `window.prompt`: in the packaged
 * Mac app every button that used it appeared to do nothing at all, while
 * working fine in a browser. Anything that needs a name typed in must use this.
 *
 * Rendered through a portal at the top of the stack, since these are opened
 * from inside other modals.
 */
const TextPromptModal = ({ isOpen, title, label, placeholder = '', initialValue = '', confirmText = 'Add', onCancel, onSubmit }) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            // After paint, or the field the user is meant to type into is not focused.
            const id = setTimeout(() => inputRef.current?.focus(), 0);
            return () => clearTimeout(id);
        }
        return undefined;
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const submit = (e) => {
        e?.preventDefault();
        // A portal's events still bubble up the React tree, and the grocery
        // builder sits inside the expense form: without this, saving a brand
        // name also submitted that expense and closed the whole dialog.
        e?.stopPropagation();
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
    };

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2147483647, backdropFilter: 'blur(6px)' }}
            onClick={onCancel}
        >
            <form
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#18181b] p-5 shadow-2xl"
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-black text-white">{title}</h3>
                    <button type="button" onClick={onCancel} className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
                {label && <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">{label}</label>}
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50"
                />
                <div className="mt-4 flex gap-2">
                    <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-300 hover:bg-white/5">
                        Cancel
                    </button>
                    <button type="submit" disabled={!value.trim()} className="flex-[2] rounded-xl bg-emerald-500 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-400 disabled:opacity-40">
                        {confirmText}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
};

export default TextPromptModal;
