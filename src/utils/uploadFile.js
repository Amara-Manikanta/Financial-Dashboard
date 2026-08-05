/**
 * Upload helpers for item photos and bills.
 *
 * Files are stored on disk by the API server and referenced by URL. They are
 * deliberately never embedded in db.json as base64: doing so previously added
 * megabytes to every read and write of the database and made the attachments
 * collateral damage whenever a bad write landed.
 */

const MAX_BYTES = 10 * 1024 * 1024;

/** Read a File into a data URL. */
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(file);
});

/**
 * Shrink an image so stored photos stay a sensible size.
 * Non-images (PDF bills) are passed through untouched.
 */
const compressImage = (dataUrl, maxWidth = 1200, maxHeight = 1200) => new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        if (scale === 1) return resolve(dataUrl);

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
});

/**
 * Store a File and return { url, name, mimeType }.
 * `label` names the file on disk so db/images stays browsable by eye.
 */
export const uploadFile = async (file, label, folder = 'images') => {
    if (!file) throw new Error('No file selected');
    if (file.size > MAX_BYTES) throw new Error('File is larger than 10MB');

    let dataUrl = await readAsDataUrl(file);
    // Scanned paperwork is left at full resolution so small print stays legible;
    // only item photos are downsized.
    if (file.type.startsWith('image/') && folder !== 'documents') {
        dataUrl = await compressImage(dataUrl);
    }

    const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, name: label || file.name || 'file', folder })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `Upload failed (${res.status})`);

    return { url: payload.url, name: file.name, mimeType: file.type };
};

/** True for a stored reference we can actually render as an image. */
export const isImageRef = (ref) => {
    const url = typeof ref === 'string' ? ref : ref?.url || '';
    return !/\.pdf($|\?)/i.test(url);
};
