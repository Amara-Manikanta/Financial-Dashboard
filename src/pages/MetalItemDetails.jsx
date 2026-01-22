import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import { ArrowLeft, Trash2, Plus, Image as ImageIcon, MapPin, Calendar, Weight, Info, Save } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';

const MetalItemDetails = () => {
    const { type, itemId } = useParams();
    const navigate = useNavigate();
    const { metals, updateMetal, formatCurrency } = useFinance();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

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

    // Normalize images: legacy 'image' field vs new 'images' array
    const getImages = () => {
        if (item.images && Array.isArray(item.images)) {
            return item.images;
        }
        if (item.image) {
            return [item.image];
        }
        return [];
    };

    const images = getImages();
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
    const colorClass = type === 'gold' ? 'text-yellow-400' : 'text-slate-300';
    const accentBg = type === 'gold' ? 'bg-yellow-500' : 'bg-slate-500';

    const handleAddPhoto = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
            // Add new image to the array (prepend or append)
            const newImages = [...images, reader.result];

            // Update item: maintain legacy 'image' as the first image for backward compat in list view
            const updatedItem = {
                ...item,
                images: newImages,
                image: newImages.length > 0 ? newImages[0] : ''
            };

            updateMetal(type, updatedItem);
            setIsUploading(false);
            e.target.value = ''; // Reset input
        };
        reader.readAsDataURL(file);
    };

    const handleDeletePhoto = (indexToDelete) => {
        if (!window.confirm("Are you sure you want to delete this photo?")) return;

        const newImages = images.filter((_, index) => index !== indexToDelete);

        const updatedItem = {
            ...item,
            images: newImages,
            // If deleting the first photo (cover), update 'image' field to the new first photo
            image: newImages.length > 0 ? newImages[0] : ''
        };

        updateMetal(type, updatedItem);
    };

    return (
        <div className="animate-fade-in pb-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate(`/metals/${type}`)}
                    className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Back to {formattedType}</span>
                </button>
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
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                        {images.map((imgSrc, index) => (
                            <div key={index} className="group relative aspect-square bg-black/20 rounded-3xl overflow-hidden border border-white/10 shadow-lg">
                                <img
                                    src={imgSrc}
                                    alt={`${item.name} - ${index + 1}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 gallery-overlay transition-all duration-300 flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => handleDeletePhoto(index)}
                                        className="p-3 bg-red-500/20 text-red-200 rounded-full hover:bg-red-500 hover:text-white transition-all transform hover:scale-110"
                                        title="Delete Photo"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                                {/* Badge for cover photo */}
                                {index === 0 && (
                                    <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 z-10 pointer-events-none">
                                        <span className="text-[10px] text-white font-bold uppercase tracking-widest">Cover</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {images.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 bg-[#1c1c20] rounded-[32px] border border-white/5 border-dashed opacity-50">
                            <ImageIcon size={48} className="text-gray-600 mb-4" />
                            <p className="text-gray-500 font-bold">No photos added yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MetalItemDetails;
