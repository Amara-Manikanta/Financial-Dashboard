import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Trash2, Plus, Image as ImageIcon, MapPin, Calendar, Weight, Info, Save, FileText, Receipt, Download, AlertTriangle } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import BackButton from '../components/BackButton';
import { uploadFile, isImageRef } from '../utils/uploadFile';

const MetalItemDetails = () => {
    const { type, itemId } = useParams();
    const navigate = useNavigate();
    const { metals, updateMetal, formatCurrency } = useFinance();
    const fileInputRef = useRef(null);
    const billInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isUploadingBill, setIsUploadingBill] = useState(false);
    const [uploadError, setUploadError] = useState('');
    // Photos whose file no longer exists on disk (dead legacy seed paths).
    // Tracked so a graceful placeholder replaces the browser's broken icon.
    const [brokenImages, setBrokenImages] = useState({});

    // Find the item
    const metalItems = metals[type] || [];
    const item = metalItems.find(i => i.id.toString() === itemId);

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                <h2 className="text-2xl font-bold text-white mb-4">Item not found</h2>
                <button
                    onClick={() => navigate(`/metals/${type}`)}
                    className="px-6 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-all"
                >
                    Return to {type} Portfolio
                </button>
            </div>
        );
    }

    // Normalise photos: legacy single 'image'/'imageUrl' vs the 'images' array.
    // No placeholder is mixed in here — a fallback used to be appended, which
    // made the list never empty and left a deleted photo apparently undeletable.
    const getImages = () => {
        if (Array.isArray(item.images) && item.images.length > 0) {
            return item.images.filter(Boolean);
        }
        const singleImg = item.imageUrl || item.image || item.photo;
        return singleImg ? [singleImg] : [];
    };

    const images = getImages();
    const bills = Array.isArray(item.bills) ? item.bills.filter(Boolean) : [];
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    const colorClass = type === 'gold' ? 'text-yellow-400' : 'text-slate-300';
    const accentBg = type === 'gold' ? 'bg-yellow-500' : 'bg-slate-500';

    /** Write a new photo list, keeping every legacy field consistent with it. */
    const saveImages = (newImages) => {
        const cover = newImages[0] || '';
        updateMetal(type, {
            ...item,
            images: newImages,
            // All three legacy fields must be rewritten. Clearing only `image`
            // left `imageUrl` pointing at the old photo, so getImages() revived
            // it and the photo could never actually be deleted.
            image: cover,
            imageUrl: cover,
            photo: cover
        });
    };

    const handleAddPhoto = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setIsUploading(true);
        setUploadError('');
        try {
            const { url } = await uploadFile(file, item.name);
            saveImages([...images, url]);
        } catch (err) {
            console.error('Photo upload failed:', err);
            setUploadError(err.message || 'Photo upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePhoto = (indexToDelete) => {
        if (!window.confirm('Are you sure you want to delete this photo?')) return;
        saveImages(images.filter((_, index) => index !== indexToDelete));
    };

    const handleAddBill = async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;

        setIsUploadingBill(true);
        setUploadError('');
        try {
            const stored = await uploadFile(file, `${item.name}-bill`);
            updateMetal(type, {
                ...item,
                bills: [...bills, { ...stored, uploadedAt: new Date().toISOString() }]
            });
        } catch (err) {
            console.error('Bill upload failed:', err);
            setUploadError(err.message || 'Bill upload failed');
        } finally {
            setIsUploadingBill(false);
        }
    };

    const handleDeleteBill = (indexToDelete) => {
        if (!window.confirm('Remove this bill?')) return;
        updateMetal(type, { ...item, bills: bills.filter((_, i) => i !== indexToDelete) });
    };

    return (
        <div className="animate-fade-in pb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <BackButton label={`Back to ${formattedType}`} to={`/metals/${type}`} style={{ marginBottom: 0 }} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Details Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#1c1c20] rounded-[32px] p-6 border border-white/5 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            {type === 'gold' ? (
                                <div className="w-32 h-32 bg-yellow-500 rounded-full blur-3xl"></div>
                            ) : (
                                <div className="w-32 h-32 bg-slate-500 rounded-full blur-3xl"></div>
                            )}
                        </div>

                        <div className="relative z-10">
                            <h1 className="text-3xl font-black text-white leading-tight mb-2">{item.name}</h1>
                            <div className="flex items-center gap-2 text-gray-400 mb-8">
                                <MapPin size={14} className={colorClass} />
                                <span className="text-xs font-bold uppercase tracking-wider">{item.place || 'Unknown Place'}</span>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-xl text-gray-400">
                                            <Weight size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Weight</p>
                                            <p className="text-white font-bold">{item.weightGm}g</p>
                                        </div>
                                    </div>
                                    {item.purity && (
                                        <div className="text-right">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Purity</p>
                                            <p className={`font-black ${colorClass}`}>{item.purity}K</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white/5 rounded-xl text-gray-400">
                                            <Calendar size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Date</p>
                                            <p className="text-white font-bold">{formatDate(item.purchaseDate)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Current Value</p>
                                    <p className="text-2xl font-black text-white">{formatCurrency(item.currentValue)}</p>
                                </div>
                            </div>

                            {item.remarks && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info size={14} className="text-gray-500" />
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Remarks</p>
                                    </div>
                                    <p className="text-sm text-gray-400 leading-relaxed font-medium">{item.remarks}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Gallery Column */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-black text-white">Photo Gallery</h2>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full ${accentBg} text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-lg`}
                            disabled={isUploading}
                        >
                            <Plus size={16} />
                            <span>{isUploading ? 'Adding...' : 'Add Photo'}</span>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleAddPhoto}
                        />
                    </div>

                    {/* Custom styles to ensure overlay works even if Tailwind JIT has issues */}
                    <style>{`
                        .gallery-overlay {
                            opacity: 0;
                            visibility: hidden;
                            backdrop-filter: none;
                            background-color: rgba(0, 0, 0, 0.4);
                        }
                        .group:hover .gallery-overlay {
                            opacity: 1;
                            visibility: visible;
                            backdrop-filter: blur(4px);
                        }
                    `}</style>
                    {uploadError && (
                        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                            <span className="text-xs font-bold text-rose-300">{uploadError}</span>
                        </div>
                    )}

                    {images.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                            {images.map((imgSrc, index) => (
                                <div key={`${imgSrc}-${index}`} className="group relative aspect-square bg-black/20 rounded-3xl overflow-hidden border border-white/10 shadow-lg">
                                    {brokenImages[imgSrc] ? (
                                        // The file behind this reference is gone. Show why, and keep
                                        // the delete control reachable so it can be cleared.
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center bg-white/[0.02]">
                                            <AlertTriangle size={26} className="text-amber-500/70" />
                                            <p className="text-[11px] font-bold text-gray-400">Image unavailable</p>
                                            <p className="text-[9px] text-gray-600 break-all leading-tight">{imgSrc}</p>
                                        </div>
                                    ) : (
                                        <img
                                            src={imgSrc}
                                            alt={`${item.name} - ${index + 1}`}
                                            onError={() => setBrokenImages((prev) => ({ ...prev, [imgSrc]: true }))}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    )}
                                    <div className="absolute inset-0 gallery-overlay transition-all duration-300 flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => handleDeletePhoto(index)}
                                            className="p-3 bg-red-500/20 text-red-200 rounded-full hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                            title="Delete Photo"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                    {index === 0 && !brokenImages[imgSrc] && (
                                        <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 z-10 pointer-events-none">
                                            <span className="text-[10px] text-white font-bold uppercase tracking-widest">Cover</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-[#1c1c20] rounded-[32px] border border-white/5 border-dashed">
                            <ImageIcon size={48} className="text-gray-600 mb-4" />
                            <p className="text-gray-500 font-bold">No photos added yet</p>
                            <p className="text-gray-600 text-xs mt-1">Use Add Photo to attach one</p>
                        </div>
                    )}

                    {/* Purchase bills — images or PDF receipts kept with the item */}
                    <div className="flex items-center justify-between mt-12 mb-6">
                        <div className="flex items-center gap-3">
                            <Receipt size={22} className={colorClass} />
                            <h2 className="text-2xl font-black text-white tracking-tight">Bills &amp; Receipts</h2>
                            {bills.length > 0 && (
                                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-gray-400">
                                    {bills.length}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => billInputRef.current?.click()}
                            disabled={isUploadingBill}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl ${accentBg} text-white font-black text-xs uppercase tracking-widest shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            <Plus size={16} />
                            <span>{isUploadingBill ? 'Uploading...' : 'Add Bill'}</span>
                        </button>
                        <input
                            type="file"
                            ref={billInputRef}
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={handleAddBill}
                        />
                    </div>

                    {bills.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {bills.map((bill, index) => {
                                const url = typeof bill === 'string' ? bill : bill.url;
                                const label = (typeof bill === 'string' ? '' : bill.name) || `Bill ${index + 1}`;
                                return (
                                    <div key={`${url}-${index}`} className="group flex items-center gap-4 p-4 bg-[#1c1c20] rounded-3xl border border-white/5 hover:border-white/15 transition-all">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                            {isImageRef(url) ? (
                                                <img src={url} alt={label} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                                                    <FileText size={24} className="text-rose-300" />
                                                </div>
                                            )}
                                        </a>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{label}</p>
                                            {bill.uploadedAt && (
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                                                    {formatDate(bill.uploadedAt)}
                                                </p>
                                            )}
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-gray-400 hover:text-white transition-colors"
                                            >
                                                <Download size={12} /> Open
                                            </a>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteBill(index)}
                                            className="p-2.5 rounded-full text-gray-600 hover:text-white hover:bg-red-500 transition-all shrink-0"
                                            title="Remove bill"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-14 bg-[#1c1c20] rounded-[32px] border border-white/5 border-dashed">
                            <Receipt size={40} className="text-gray-600 mb-3" />
                            <p className="text-gray-500 font-bold">No bills uploaded</p>
                            <p className="text-gray-600 text-xs mt-1">Attach a photo or PDF of the purchase receipt</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MetalItemDetails;
