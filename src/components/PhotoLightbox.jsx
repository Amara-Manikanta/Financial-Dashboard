import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A photo, full screen.
 *
 * Shared between the ornament gallery and an item's own photo grid. It was
 * written once inside the gallery and would have been written a second time
 * here — the same way two copies of the sector table drifted apart.
 *
 * `photos` is a list of URLs; `index` says which one is open and `onIndex`
 * moves it, so the caller owns the position and can restore it after a
 * reorder. Rendered through a portal because the grid sits inside containers
 * with their own stacking and overflow, and an overlay inside one of those is
 * clipped by it.
 */
const PhotoLightbox = ({
    photos = [], index = 0, onIndex, onClose, caption = null, actions = null,
}) => {
    const count = photos.length;

    const step = useCallback((delta) => {
        if (!onIndex || count === 0) return;
        const next = index + delta;
        if (next < 0 || next >= count) return;
        onIndex(next);
    }, [index, count, onIndex]);

    // On the window rather than the overlay: the overlay would have to hold
    // focus to receive keys, and nothing inside it is focusable.
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
            else if (e.key === 'ArrowRight') step(1);
            else if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [step, onClose]);

    // The page behind must not scroll while this is open, or a trackpad flick
    // moves the grid under the overlay and the position is lost on close.
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, []);

    const src = photos[index];
    if (!src) return null;

    return createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1200,
                backgroundColor: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
            }}
        >
            <button onClick={onClose} aria-label="Close"
                style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                <X size={26} />
            </button>

            {index > 0 && (
                <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous"
                    style={{ position: 'absolute', left: '1rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '999px', padding: '0.6rem', color: 'white', cursor: 'pointer' }}>
                    <ChevronLeft size={22} />
                </button>
            )}
            {index < count - 1 && (
                <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next"
                    style={{ position: 'absolute', right: '1rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '999px', padding: '0.6rem', color: 'white', cursor: 'pointer' }}>
                    <ChevronRight size={22} />
                </button>
            )}

            <div
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
            >
                <img
                    src={src}
                    alt={typeof caption === 'string' ? caption : 'Photo'}
                    style={{ maxWidth: '94vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: '0.75rem' }}
                />
                {caption}
                {actions}
                {count > 1 && (
                    <p style={{ fontSize: '0.66rem', color: '#52525b', margin: 0 }}>
                        {index + 1} of {count} · arrow keys to move · Esc to close
                    </p>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default PhotoLightbox;
