import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { db } from '../db';

export const useAutoSave = () => {
    const { elements, setElements } = useStore();
    const isLoaded = useRef(false);

    // Load on mount
    useEffect(() => {
        const load = async () => {
            try {
                const savedElements = await db.elements.toArray();
                if (savedElements.length > 0) {
                    console.log(`Loaded ${savedElements.length} elements from DB`);
                    setElements(savedElements);
                }
                isLoaded.current = true;
            } catch (error) {
                console.error("Failed to load drawings:", error);
            }
        };
        load();
    }, [setElements]);

    // Save on change (Debounced)
    useEffect(() => {
        if (!isLoaded.current) return; // Don't save before loading

        const save = async () => {
            try {
                // Simple sync: Clear and Rewrite
                // Optimization: In real app, diff changes.
                await db.elements.clear();
                await db.elements.bulkPut(elements);
                console.log("Auto-saved to DB");
            } catch (error) {
                console.error("Auto-save failed:", error);
            }
        };

        const timeoutId = setTimeout(save, 2000); // 2s debounce
        return () => clearTimeout(timeoutId);
    }, [elements]);
};
