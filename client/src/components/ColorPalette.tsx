import { useStore } from '../store';


const PALETTE = [
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#4b5563' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Rose', value: '#f43f5e' },
];

export const ColorPalette = () => {
    const { strokeColor, setStrokeColor } = useStore();

    return (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 grid grid-cols-2 gap-2 z-40">
            {PALETTE.map((color) => (
                <button
                    key={color.value}
                    onClick={() => setStrokeColor(color.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${strokeColor === color.value
                        ? 'border-gray-900 scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                        }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                />
            ))}
        </div>
    );
};
