/**
 * Where an ornament's photos live, in one place.
 *
 * An item may carry its photos in any of four fields — `images[]`, `imageUrl`,
 * `image`, `photo` — because the shape changed twice and nothing migrated. The
 * item page already normalised them; the category grid did its own slightly
 * different version inline, and reached for a seed placeholder in the middle of
 * the same expression, so "has a photo" and "shows a photo" were not the same
 * question. This is the one answer.
 *
 * No placeholder is ever mixed in. A fallback inside the list is what once made
 * a deleted photo undeletable: the list was never empty, so the old image kept
 * coming back. Callers decide what to draw when there is nothing.
 */

/** Every photo on an item, newest field shape first, placeholders excluded. */
export const photosOf = (item) => {
    if (!item) return [];
    if (Array.isArray(item.images) && item.images.length > 0) {
        return item.images.filter(Boolean);
    }
    const single = item.imageUrl || item.image || item.photo;
    return single ? [single] : [];
};

/** The URL string for a photo, which may be stored as a string or an object. */
export const photoUrl = (photo) => (typeof photo === 'string' ? photo : photo?.url || '');

/** The cover image, or null. */
export const coverOf = (item) => photoUrl(photosOf(item)[0]) || null;

export const hasPhoto = (item) => photosOf(item).length > 0;

/**
 * Every photographed ornament across all metal categories, flattened.
 *
 * `withoutPhotos` is returned alongside rather than discarded: 17 of 73 items
 * have a picture, and a gallery that silently showed only those would suggest
 * the collection is 17 pieces. The gap is the more useful number.
 */
export const galleryItems = (metals = {}) => {
    const shots = [];
    const withoutPhotos = [];

    Object.entries(metals || {}).forEach(([category, items]) => {
        (items || []).forEach((item) => {
            const photos = photosOf(item);
            if (photos.length === 0) {
                withoutPhotos.push({ category, item });
                return;
            }
            photos.forEach((photo, index) => {
                const url = photoUrl(photo);
                if (!url) return;
                shots.push({
                    // An item with three photos yields three tiles, so the id
                    // has to include the index or React reuses one node for all
                    // of them and the lightbox opens the wrong picture.
                    id: `${category}:${item.id}:${index}`,
                    category,
                    item,
                    url,
                    index,
                    total: photos.length,
                    name: item.name || item.title || 'Unnamed',
                    weight: Number(item.weight) || 0,
                    purity: item.purity || '',
                });
            });
        });
    });

    return { shots, withoutPhotos };
};

export const CATEGORY_LABELS = {
    gold: 'Gold',
    silver: 'Silver',
    platinum: 'Platinum',
    antique_coins: 'Antique Coins',
    currencies: 'Currencies',
};

export const CATEGORY_COLORS = {
    gold: '#fbbf24',
    silver: '#cbd5e1',
    platinum: '#a5b4fc',
    antique_coins: '#f59e0b',
    currencies: '#34d399',
};

export const categoryLabel = (c) => CATEGORY_LABELS[c] || c;
export const categoryColor = (c) => CATEGORY_COLORS[c] || '#71717a';
