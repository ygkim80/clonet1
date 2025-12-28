import { useStore } from '../store';

const COLORS = [
    { name: 'Black', value: '#000000' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Purple', value: '#a855f7' },
];

export const ColorPalette = () => {
    const { strokeColor, setStrokeColor } = useStore();

    return (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2 z-40">
            {COLORS.map((color) => (
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
