import React from 'react';
import { 
    Target, Home, Car, Plane, GraduationCap, Heart, Palmtree, Zap, Laptop, 
    TrendingUp, Gem, Gift, Shield, PiggyBank, Building, ShoppingBag, Sparkles
} from 'lucide-react';

export const GOAL_ICONS = [
    { id: 'home_3d', label: '3D House', type: 'image', src: '/icons/home_3d.png' },
    { id: 'retirement', label: 'Retirement', type: 'image', src: '/icons/retirement.png' },
    { id: 'investments', label: 'Investments', type: 'image', src: '/icons/investments.png' },
    { id: 'emergency', label: 'Emergency Fund', type: 'image', src: '/icons/emergency.png' },
    { id: 'car', label: 'Car / Vehicle', type: 'image', src: '/icons/car.png' },
    { id: 'travel', label: 'Travel', type: 'image', src: '/icons/travel.png' },
    { id: 'wedding', label: 'Wedding', type: 'image', src: '/icons/wedding.png' },
    { id: 'education', label: 'Education', type: 'image', src: '/icons/education.png' },
    { id: 'Target', label: 'Target', type: 'lucide', Icon: Target, color: '#38bdf8' },
    { id: 'Zap', label: 'Zap / Alert', type: 'lucide', Icon: Zap, color: '#f59e0b' },
    { id: 'Laptop', label: 'Gadget / Tech', type: 'lucide', Icon: Laptop, color: '#818cf8' },
    { id: 'TrendingUp', label: 'Wealth', type: 'lucide', Icon: TrendingUp, color: '#10b981' },
    { id: 'Gem', label: 'Gold / Gem', type: 'lucide', Icon: Gem, color: '#fb7185' },
    { id: 'Gift', label: 'Celebration', type: 'lucide', Icon: Gift, color: '#c084fc' },
    { id: 'Shield', label: 'Protection', type: 'lucide', Icon: Shield, color: '#38bdf8' },
    { id: 'PiggyBank', label: 'Savings', type: 'lucide', Icon: PiggyBank, color: '#f43f5e' },
    { id: 'Building', label: 'Real Estate', type: 'lucide', Icon: Building, color: '#fb923c' },
    { id: 'ShoppingBag', label: 'Shopping', type: 'lucide', Icon: ShoppingBag, color: '#e879f9' },
    { id: 'Sparkles', label: 'Dreams', type: 'lucide', Icon: Sparkles, color: '#facc15' },
];

export const GoalIconDisplay = ({ iconId, size = 24, className = "" }) => {
    if (iconId === 'home_3d') return <img src="/icons/home_3d.png" alt="House" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'retirement') return <img src="/icons/retirement.png" alt="Retirement" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'investments') return <img src="/icons/investments.png" alt="Investments" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'emergency') return <img src="/icons/emergency.png" alt="Emergency Fund" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'car' || iconId === 'Car') return <img src="/icons/car.png" alt="Car" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'travel') return <img src="/icons/travel.png" alt="Travel" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'wedding') return <img src="/icons/wedding.png" alt="Wedding" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (iconId === 'education') return <img src="/icons/education.png" alt="Education" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    if (typeof iconId === 'string' && (iconId.endsWith('.png') || iconId.startsWith('/'))) {
        return <img src={iconId} alt="Goal Icon" style={{ width: size, height: size, objectFit: 'contain' }} className={className} />;
    }
    const found = GOAL_ICONS.find(i => i.id === iconId);
    if (found && found.type === 'lucide') {
        const Icon = found.Icon;
        return <Icon size={size} style={{ color: found.color }} className={className} />;
    }
    return <Target size={size} style={{ color: '#38bdf8' }} className={className} />;
};
