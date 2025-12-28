import { create } from 'zustand';

export type ToolType = 'selection' | 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'line' | 'text' | 'laser';

interface AppState {
    tool: ToolType;
    setTool: (tool: ToolType) => void;
    elements: any[];
    setElements: (elements: any[]) => void;
    addElement: (element: any) => void;
    updateElement: (index: number, element: any) => void;
    camera: { x: number; y: number; zoom: number };
    setCamera: (camera: { x: number; y: number; zoom: number }) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    past: any[][];
    future: any[][];
    saveSnapshot: () => void;
    undo: () => void;
    redo: () => void;
    selectedElementId: string | null;
    selectElement: (id: string | null) => void;
    strokeColor: string;
    setStrokeColor: (color: string) => void;
}

export const useStore = create<AppState>((set) => ({
    tool: 'selection',
    setTool: (tool) => set({ tool }),
    elements: [],
    setElements: (elements) => set({ elements }),
    addElement: (element) => set((state) => ({ elements: [...state.elements, element] })),
    updateElement: (index, element) =>
        set((state) => {
            const newElements = [...state.elements];
            newElements[index] = element;
            return { elements: newElements };
        }),
    // History State
    past: [],
    future: [],
    saveSnapshot: () => set((state) => ({
        past: [...state.past, state.elements],
        future: []
    })),
    undo: () => set((state) => {
        if (state.past.length === 0) return {};
        const previous = state.past[state.past.length - 1];
        const newPast = state.past.slice(0, state.past.length - 1);
        return {
            past: newPast,
            future: [state.elements, ...state.future],
            elements: previous
        };
    }),
    redo: () => set((state) => {
        if (state.future.length === 0) return {};
        const next = state.future[0];
        const newFuture = state.future.slice(1);
        return {
            past: [...state.past, state.elements],
            future: newFuture,
            elements: next
        };
    }),

    // Selection State
    selectedElementId: null,
    selectElement: (id) => set({ selectedElementId: id }),

    // Camera State
    camera: { x: 0, y: 0, zoom: 1 },
    setCamera: (camera) => set({ camera }),
    zoomIn: () => set((state) => ({ camera: { ...state.camera, zoom: Math.min(state.camera.zoom * 1.1, 5) } })),
    zoomOut: () => set((state) => ({ camera: { ...state.camera, zoom: Math.max(state.camera.zoom / 1.1, 0.1) } })),

    // Color State
    strokeColor: '#000000',
    setStrokeColor: (color) => set({ strokeColor: color }),
}));
