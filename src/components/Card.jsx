import React from 'react';

const Card = ({ title, value, icon: Icon, trend, colorClass = 'text-primary' }) => {
    return (
        <div className="card">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-secondary text-sm font-medium mb-1">{title}</p>
                    <h3 className="text-2xl font-bold">{value}</h3>
                </div>
                {Icon && (
                    <div className={`p-2 rounded-lg bg-opacity-10 ${colorClass.replace('text-', 'bg-')}`}>
                        <Icon className={colorClass} size={24} />
                    </div>
                )}
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-sm">
                    <span className={trend > 0 ? 'text-success' : 'text-danger'}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                    <span className="text-secondary">vs last month</span>
                </div>
            )}
        </div>
    );
};

export default Card;
