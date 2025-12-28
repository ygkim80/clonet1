import React, { useRef } from 'react';
import { useStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import { exportCanvas, importCanvas } from '../data/fileOps';

import { Modal } from './Modal';

export const Header = () => {
    const { elements, setElements, undo, redo, saveSnapshot } = useStore();
    const { sendMessage } = useWebSocket();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isClearModalOpen, setIsClearModalOpen] = React.useState(false);

    const handleSave = () => {
        exportCanvas(elements);
    };

    const handleOpen = () => {
        fileInputRef.current?.click();
    };

    const handleClearClick = () => {
        if (elements.length === 0) return;
        setIsClearModalOpen(true);
    };

    const confirmClear = () => {
        saveSnapshot();
        setElements([]);
        sendMessage([]); // Broadcast clear
        setIsClearModalOpen(false);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            if (!file.name.endsWith('.clonet1') && file.type !== 'application/json') {
                alert('Please select a valid .clonet1 file');
                return;
            }

            const loadedElements = await importCanvas(file);
            // Replace simple confirm with direct load for now, or we can add another modal.
            // keeping confirm for file load for assumed simplicity unless requested
            if (elements.length > 0 && !confirm('This will replace your current drawing. Continue?')) {
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            setElements(loadedElements);
        } catch (error) {
            console.error('Failed to load file:', error);
            alert('Failed to load file. Check console for details.');
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <div className="fixed top-4 left-4 flex gap-2 z-50">
                {/* Header / Menu Buttons */}
                <button
                    onClick={handleSave}
                    className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium transition-colors"
                    title="Save current drawing"
                >
                    Save File
                </button>
                <button
                    onClick={handleOpen}
                    className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium transition-colors"
                    title="Open a .clonet1 file"
                >
                    Open File
                </button>

                <div className="w-px h-8 bg-gray-300 mx-1"></div>

                <button
                    onClick={undo}
                    className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium transition-colors"
                    title="Undo (Ctrl+Z)"
                >
                    Undo
                </button>
                <button
                    onClick={redo}
                    className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium transition-colors"
                    title="Redo (Ctrl+Y)"
                >
                    Redo
                </button>

                <div className="w-px h-8 bg-gray-300 mx-1"></div>

                <button
                    onClick={handleClearClick}
                    className="bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-md shadow-sm hover:bg-red-50 text-sm font-medium transition-colors"
                    title="Clear all drawings"
                >
                    Clear
                </button>

                {/* Hidden Input for File Loading */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".clonet1,.json"
                />
            </div>

            <Modal
                isOpen={isClearModalOpen}
                title="Clear Canvas"
                onConfirm={confirmClear}
                onCancel={() => setIsClearModalOpen(false)}
                confirmText="Clear All"
                cancelText="Cancel"
                type="confirm"
            >
                <p className="text-gray-600">
                    Are you sure you want to clear the entire canvas? This action cannot be fully undone if history is lost.
                </p>
            </Modal>
        </>
    );
};
