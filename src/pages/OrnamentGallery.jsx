import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useFinance } from '../context/FinanceContext';
import { Gem, X, ChevronLeft, ChevronRight, ImageOff, ExternalLink, Camera } from 'lucide-react';
import BackButton from '../components/BackButton';
import { galleryItems, categoryLabel, categoryColor } from '../utils/ornamentPhotos';

const panel = {
    backgroundColor: 'rgba(24, 24, 27, 0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '1.25rem',
    padding: '1.5rem',
};

const label = {
    fontSize: '10px', fontWeight: 900, color: '#71717a',
    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
};

/**
 * The ornaments, as pictures.
 *
 * Every other view of this collection is a table of weights and values, which
 * is the wrong shape for jewellery: you recognise a piece by looking at it, not
 * by reading that it is 8.4g of 22K. This is the view for "which one is the
 * choker again", and for checking at a glance what still has no photograph.
 */
const OrnamentGallery = () => {
    const navigate = useNavigate();
    const { metals, formatCurrency } = useFinance();

    const [category, setCategory] = useState('All');
    const [lightbox, setLightbox] = useState(null);   // index into `shown`
    const [broken, setBroken] = useState({});

    const { shots, withoutPhotos } = useMemo(() => galleryItems(metals), [metals]);

    /**
     * Only photos that actually load.
     *
     * Counted from the same list the grid draws from, or the chips add up to
     * more than the headline: 23 of the 42 references point at files that are
     * no longer on disk, so "All 19" sat beside "Gold 30 · Silver 12".
     */
    const live = useMemo(() => shots.filter((s) => !broken[s.url]), [shots, broken]);

    const categories = useMemo(() => {
        const counts = {};
        live.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [live]);

    // A photo whose file is missing is dropped from the gallery rather than
    // left as a grey rectangle: this page is for looking at things, and a wall
    // of broken frames is worse than a shorter wall. The count is reported
    // instead, under the grid.
    const shown = useMemo(
        () => live.filter((s) => category === 'All' || s.category === category),
        [live, category],
    );

    const brokenCount = useMemo(() => shots.filter((s) => broken[s.url]).length, [shots, broken]);

    /**
     * Pieces that need a photograph — including the ones that had one.
     *
     * An item whose only picture points at a file no longer on disk is, for
     * every practical purpose, a piece with no photograph. Counting it as
     * photographed put it in neither list: 19 shown plus 31 never-photographed
     * left 23 of the 73 pieces unaccounted for, which is exactly the set most
     * in need of attention.
     */
    const needsPhoto = useMemo(() => {
        const liveIds = new Set(live.map((s) => s.item.id));
        const lost = [];
        const seen = new Set();
        shots.forEach((s) => {
            if (liveIds.has(s.item.id) || seen.has(s.item.id)) return;
            seen.add(s.item.id);
            lost.push({ category: s.category, item: s.item, lostPhoto: true });
        });
        return [...withoutPhotos.map((w) => ({ ...w, lostPhoto: false })), ...lost];
    }, [shots, live, withoutPhotos]);

    const close = useCallback(() => setLightbox(null), []);
    const step = useCallback((delta) => {
        setLightbox((i) => {
            if (i === null) return null;
            const next = i + delta;
            if (next < 0 || next >= shown.length) return i;
            return next;
        });
    }, [shown.length]);

    // Bound to the window, not the overlay: the overlay would need focus to
    // receive them, and nothing here is focusable.
    useEffect(() => {
        if (lightbox === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') close();
            else if (e.key === 'ArrowRight') step(1);
            else if (e.key === 'ArrowLeft') step(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightbox, close, step]);

    const active = lightbox !== null ? shown[lightbox] : null;

    const openItem = (shot) => navigate(`/metals/${shot.category}/${shot.item.id}`);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <BackButton label="Back to Gold & Silver" to="/metals" />

            <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'white', letterSpacing: '-0.025em', margin: 0 }}>
                    Ornament Gallery
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '0.5rem 0 0', maxWidth: '68ch', lineHeight: 1.6 }}>
                    Every piece you have photographed. Click one to see it full size, then use the arrow
                    keys to move through the collection.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ ...panel, padding: '1.15rem 1.35rem' }}>
                    <p style={label}>Photographed</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>
                        {live.length}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.2rem 0 0' }}>
                        across {new Set(live.map((s) => s.item.id)).size} pieces
                    </p>
                </div>
                <div style={{
                    ...panel, padding: '1.15rem 1.35rem',
                    ...(needsPhoto.length ? { border: '1px solid rgba(251,191,36,0.25)', backgroundColor: 'rgba(251,191,36,0.04)' } : {}),
                }}>
                    <p style={{ ...label, ...(needsPhoto.length ? { color: '#fbbf24' } : {}) }}>No photo yet</p>
                    <p style={{ fontSize: '1.65rem', fontWeight: 900, color: needsPhoto.length ? '#fbbf24' : 'white', fontFamily: 'monospace', margin: '0.3rem 0 0' }}>
                        {needsPhoto.length}
                    </p>
                    <p style={{ fontSize: '0.68rem', color: '#71717a', margin: '0.2rem 0 0' }}>listed below</p>
                </div>
            </div>

            {categories.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <button
                        onClick={() => { setCategory('All'); setLightbox(null); }}
                        style={{
                            padding: '0.45rem 0.9rem', borderRadius: '999px', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                            backgroundColor: category === 'All' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.025)',
                            border: `1px solid ${category === 'All' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
                            color: category === 'All' ? 'white' : '#71717a',
                        }}
                    >
                        All {live.length}
                    </button>
                    {categories.map((c) => {
                        const on = category === c.name;
                        const col = categoryColor(c.name);
                        return (
                            <button
                                key={c.name}
                                onClick={() => { setCategory(on ? 'All' : c.name); setLightbox(null); }}
                                style={{
                                    padding: '0.45rem 0.9rem', borderRadius: '999px', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                                    backgroundColor: on ? `${col}22` : 'rgba(255,255,255,0.025)',
                                    border: `1px solid ${on ? col : 'rgba(255,255,255,0.06)'}`,
                                    color: on ? col : '#71717a',
                                }}
                            >
                                {categoryLabel(c.name)} {c.count}
                            </button>
                        );
                    })}
                </div>
            )}

            {shown.length === 0 ? (
                <div style={{ ...panel, padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <ImageOff size={30} style={{ color: '#3f3f46', marginBottom: '0.75rem' }} />
                    <p style={{ color: '#71717a', fontSize: '0.9rem', margin: 0 }}>Nothing photographed here yet.</p>
                    <p style={{ color: '#52525b', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                        Open a piece and add a photo — it appears here straight away.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.9rem' }}>
                    {shown.map((s, i) => (
                        <div
                            key={s.id}
                            onClick={() => setLightbox(i)}
                            style={{
                                borderRadius: '1rem', overflow: 'hidden', cursor: 'zoom-in',
                                border: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.3)',
                            }}
                        >
                            <div style={{ position: 'relative', aspectRatio: '1 / 1', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                <img
                                    src={s.url}
                                    alt={s.name}
                                    loading="lazy"
                                    onError={() => setBroken((p) => ({ ...p, [s.url]: true }))}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                                {s.total > 1 && (
                                    <span style={{
                                        position: 'absolute', top: '0.5rem', right: '0.5rem',
                                        padding: '0.1rem 0.4rem', borderRadius: '0.35rem',
                                        backgroundColor: 'rgba(0,0,0,0.65)', color: '#e4e4e7',
                                        fontSize: '9px', fontWeight: 800,
                                    }}>
                                        {s.index + 1}/{s.total}
                                    </span>
                                )}
                                <span style={{
                                    position: 'absolute', top: '0.5rem', left: '0.5rem',
                                    padding: '0.1rem 0.4rem', borderRadius: '0.35rem',
                                    backgroundColor: `${categoryColor(s.category)}26`,
                                    border: `1px solid ${categoryColor(s.category)}59`,
                                    color: categoryColor(s.category), fontSize: '9px', fontWeight: 800,
                                }}>
                                    {categoryLabel(s.category)}
                                </span>
                            </div>
                            <div style={{ padding: '0.65rem 0.75rem' }}>
                                <p style={{
                                    fontSize: '0.76rem', fontWeight: 700, color: '#e4e4e7', margin: 0,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }} title={s.name}>
                                    {s.name}
                                </p>
                                <p style={{ fontSize: '0.65rem', color: '#71717a', margin: '0.15rem 0 0', fontFamily: 'monospace' }}>
                                    {s.weight > 0 ? `${s.weight}g` : '—'}{s.purity ? ` · ${s.purity}` : ''}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {brokenCount > 0 && (
                <p style={{ fontSize: '0.72rem', color: '#71717a', margin: '1rem 0 0' }}>
                    {brokenCount} photo{brokenCount === 1 ? '' : 's'} could not be loaded and {brokenCount === 1 ? 'is' : 'are'} not
                    shown — the record points at a file that is no longer on disk.
                </p>
            )}

            {needsPhoto.length > 0 && (
                <div style={{ ...panel, marginTop: '2rem' }}>
                    <p style={{ ...label, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Camera size={13} /> {needsPhoto.length} pieces with no photograph
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.5rem 0 1rem', maxWidth: '78ch', lineHeight: 1.6 }}>
                        Worth closing, and not only for the gallery: a photograph is what an insurer asks
                        for after a loss, and it is the one part of these records that cannot be
                        reconstructed later from a bill or a weight.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {needsPhoto.map(({ category: c, item, lostPhoto }) => (
                            <button
                                key={`${c}-${item.id}`}
                                onClick={() => navigate(`/metals/${c}/${item.id}`)}
                                // A piece whose photo file has gone is marked
                                // apart from one that never had a picture: the
                                // first is a broken record to repair, the second
                                // simply a photograph never taken.
                                title={lostPhoto ? 'The photo on this record is missing from disk' : 'No photo has ever been added'}
                                style={{
                                    padding: '0.3rem 0.6rem', borderRadius: '0.5rem', cursor: 'pointer',
                                    backgroundColor: lostPhoto ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${lostPhoto ? 'rgba(248,113,113,0.3)' : `${categoryColor(c)}33`}`,
                                    color: lostPhoto ? '#f87171' : '#a1a1aa', fontSize: '0.7rem', fontWeight: 600,
                                }}
                            >
                                {item.name || item.title || 'Unnamed'}{lostPhoto ? ' ⚠' : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {active && createPortal(
                <div
                    onClick={close}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1000,
                        backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
                    }}
                >
                    <button onClick={close} aria-label="Close"
                        style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}>
                        <X size={26} />
                    </button>

                    {lightbox > 0 && (
                        <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous"
                            style={{ position: 'absolute', left: '1rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '999px', padding: '0.6rem', color: 'white', cursor: 'pointer' }}>
                            <ChevronLeft size={22} />
                        </button>
                    )}
                    {lightbox < shown.length - 1 && (
                        <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next"
                            style={{ position: 'absolute', right: '1rem', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '999px', padding: '0.6rem', color: 'white', cursor: 'pointer' }}>
                            <ChevronRight size={22} />
                        </button>
                    )}

                    <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <img
                            src={active.url}
                            alt={active.name}
                            style={{ maxWidth: '92vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: '0.75rem' }}
                        />
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: 0 }}>{active.name}</p>
                            <p style={{ fontSize: '0.75rem', color: '#a1a1aa', margin: '0.3rem 0 0', fontFamily: 'monospace' }}>
                                {categoryLabel(active.category)}
                                {active.weight > 0 ? ` · ${active.weight}g` : ''}
                                {active.purity ? ` · ${active.purity}` : ''}
                                {active.total > 1 ? ` · photo ${active.index + 1} of ${active.total}` : ''}
                            </p>
                            <button
                                onClick={() => openItem(active)}
                                style={{
                                    marginTop: '0.8rem', padding: '0.5rem 1rem', borderRadius: '0.7rem',
                                    backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                                    color: '#818cf8', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                }}
                            >
                                Open this piece <ExternalLink size={12} />
                            </button>
                            <p style={{ fontSize: '0.66rem', color: '#52525b', margin: '0.75rem 0 0' }}>
                                {lightbox + 1} of {shown.length} · arrow keys to move · Esc to close
                            </p>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default OrnamentGallery;
