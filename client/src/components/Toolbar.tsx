// import React from 'react'; // React is unused in this file
import { useStore } from '../store';
import type { ToolType } from '../store';

const tools: { id: ToolType; label: string }[] = [
    { id: 'selection', label: 'Selection' },
    { id: 'rectangle', label: 'Rectangle' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'circle', label: 'Circle' },
    { id: 'arrow', label: 'Arrow' },
    { id: 'line', label: 'Line' },
    { id: 'text', label: 'Text' },
    { id: 'laser', label: 'Laser' },
];

export const Toolbar = () => {
    const { tool, setTool } = useStore();

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-2 flex gap-2 z-50">
            {tools.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    className={`p-2 rounded-md transition-all text-sm font-medium ${tool === t.id
                        ? 'bg-blue-100 text-blue-600 shadow-sm'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title={t.label}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
};
