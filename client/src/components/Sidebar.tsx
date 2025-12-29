import React from 'react';
import { useStore } from '../store';
import {
    Square, Circle, Triangle, Diamond, Command, MousePointer2,
    Database, Cloud, Star, Heart, Hexagon, Octagon,
    ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
    MessageCircle, FileText, Folder, User, Lock, Unlock,
    Calendar, Clock, Check, X, AlertTriangle, Info, Plus, Minus
} from 'lucide-react';

const SHAPES = [
    { type: 'clean_square', icon: Square, label: 'Square' },
    { type: 'clean_circle', icon: Circle, label: 'Circle' },
    { type: 'clean_triangle', icon: Triangle, label: 'Triangle' },
    { type: 'clean_diamond', icon: Diamond, label: 'Diamond' },
    { type: 'clean_parallelogram', icon: Square, label: 'Parallelogram', style: { transform: 'skewX(-20deg)' } },
    { type: 'clean_rounded_rect', icon: Square, label: 'Rounded', style: { borderRadius: '6px' } },
    { type: 'clean_cylinder', icon: Database, label: 'Database' },
    { type: 'clean_cloud', icon: Cloud, label: 'Cloud' },
    { type: 'clean_star', icon: Star, label: 'Star' },
    { type: 'clean_heart', icon: Heart, label: 'Heart' },
    { type: 'clean_hexagon', icon: Hexagon, label: 'Hexagon' },
    { type: 'clean_octagon', icon: Octagon, label: 'Octagon' },
    { type: 'clean_arrow_right', icon: ArrowRight, label: 'Right' },
    { type: 'clean_arrow_left', icon: ArrowLeft, label: 'Left' },
    { type: 'clean_arrow_up', icon: ArrowUp, label: 'Up' },
    { type: 'clean_arrow_down', icon: ArrowDown, label: 'Down' },
    { type: 'clean_message', icon: MessageCircle, label: 'Message' },
    { type: 'clean_file', icon: FileText, label: 'File' },
    { type: 'clean_folder', icon: Folder, label: 'Folder' },
    { type: 'clean_user', icon: User, label: 'User' },
    { type: 'clean_lock', icon: Lock, label: 'Lock' },
    { type: 'clean_unlock', icon: Unlock, label: 'Unlock' },
    { type: 'clean_calendar', icon: Calendar, label: 'Calendar' },
    { type: 'clean_clock', icon: Clock, label: 'Clock' },
    { type: 'clean_check', icon: Check, label: 'Check' },
    { type: 'clean_cross', icon: X, label: 'Cross' },
    { type: 'clean_alert', icon: AlertTriangle, label: 'Alert' },
    { type: 'clean_info', icon: Info, label: 'Info' },
    { type: 'clean_plus', icon: Plus, label: 'Plus' },
    { type: 'clean_minus', icon: Minus, label: 'Minus' },
];

export const Sidebar = () => {
    const { tool } = useStore();
    const isSelectionTool = tool === 'selection';

    const handleDragStart = (e: React.DragEvent, shapeType: string) => {
        if (!isSelectionTool) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('shapeType', shapeType);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="absolute top-16 right-4 w-48 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col max-h-[calc(100vh-6rem)] z-30">
            <div className="p-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shape Library</h3>
                {!isSelectionTool && (
                    <p className="text-[10px] text-red-500 mt-1">Select 'Selection Tool' to drag</p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                <div className="grid grid-cols-2 gap-2">
                    {SHAPES.map((shape: any) => (
                        <div
                            key={shape.type}
                            draggable={isSelectionTool}
                            onDragStart={(e) => handleDragStart(e, shape.type)}
                            className={`
                                flex flex-col items-center justify-center p-3 rounded-md border transition-all
                                ${isSelectionTool
                                    ? 'cursor-grab hover:bg-blue-50 hover:border-blue-200 active:cursor-grabbing border-gray-100'
                                    : 'cursor-not-allowed opacity-50 border-transparent bg-gray-50'
                                }
                            `}
                            title={shape.label}
                        >
                            {/* Render icon with custom styles if needed */}
                            <div style={shape.style || {}}>
                                <shape.icon size={20} className="text-gray-700 mb-1" />
                            </div>
                            <span className="text-[10px] text-gray-500 text-center leading-tight">{shape.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
