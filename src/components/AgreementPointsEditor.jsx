import React from 'react';
import { Trash2 } from 'lucide-react';

/**
 * The terms of a tenancy, as separate lines.
 *
 * "Current bill paid by tenant" is the sort of thing you need to find in ten
 * seconds during a disagreement, and a free-text paragraph is where it goes to
 * hide. Each point is its own row so it can be read, reordered by editing, and
 * removed on its own.
 *
 * ## The suggestions stay
 *
 * They used to render only while the list was empty, so picking one made the
 * other four vanish — which read as "you may choose one" when the whole point
 * is that a tenancy has several terms. Every suggestion not already on the list
 * stays available until it is used.
 *
 * Shared between the property form and the unit form. Two copies of this had
 * already been written and would have drifted the first time either changed.
 */
const SUGGESTIONS = [
    'Current bill paid by tenant',
    'Water bill paid by tenant',
    '2 months notice',
    '11 month lock-in',
    'Maintenance by tenant',
    'No subletting',
    'Rent due by the 5th',
    'Painting on vacating',
];

const inputClass = 'flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white font-medium '
    + 'placeholder:text-gray-700 focus:outline-none focus:border-emerald-500/50 transition-all text-sm';

const norm = (s) => String(s || '').trim().toLowerCase();

const AgreementPointsEditor = ({ terms = [], onChange }) => {
    const list = Array.isArray(terms) ? terms : [];
    const used = new Set(list.map(norm));
    const remaining = SUGGESTIONS.filter((s) => !used.has(norm(s)));

    const add = (value = '') => onChange([...list, value]);
    const update = (i, value) => onChange(list.map((t, j) => (j === i ? value : t)));
    const remove = (i) => onChange(list.filter((_, j) => j !== i));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
                <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest">
                    Agreement points
                </label>
                <button
                    type="button"
                    onClick={() => add('')}
                    className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest"
                >
                    + Write your own
                </button>
            </div>

            {list.map((term, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="flex gap-2 items-center">
                    <span className="text-emerald-500 text-xs font-black w-4 text-center shrink-0">{i + 1}</span>
                    <input
                        value={term}
                        onChange={(e) => update(i, e.target.value)}
                        placeholder="e.g. Current bill paid by tenant"
                        className={inputClass}
                    />
                    <button
                        type="button"
                        onClick={() => remove(i)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition-all shrink-0"
                        aria-label="Remove point"
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            ))}

            {remaining.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                    {remaining.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => add(s)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white hover:border-emerald-500/40 transition-all"
                        >
                            + {s}
                        </button>
                    ))}
                </div>
            )}

            {list.length === 0 && (
                <p className="text-[10px] text-zinc-600 ml-1">
                    Add as many as apply — these are the lines you will want to point at later.
                </p>
            )}
        </div>
    );
};

export default AgreementPointsEditor;
