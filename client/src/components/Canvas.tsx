import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Path, Line as KonvaLine, Text, Ellipse, Rect, Star } from 'react-konva';
import rough from 'roughjs';
import Konva from 'konva';
import { useStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import { Modal } from './Modal';

const generator = rough.generator();

export const Canvas = () => {
    const { tool, elements, addElement, updateElement, camera, setCamera, saveSnapshot, selectedElementId, selectElement, strokeColor } = useStore();
    const { sendMessage } = useWebSocket();
    // Drop Handler
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const shapeType = e.dataTransfer.getData('shapeType');
        if (!shapeType || tool !== 'selection') return;

        const stage = (e.target as any).getStage ? (e.target as any).getStage() : null;
        // If dropped on DOM element over canvas, might need calculating client rect.
        // Simplified: use clientX/Y and convert with stage logic if available, or just camera logic.

        // Better: standard client coords to canvas coords conversion
        // x = (clientX - stageX) / scale
        // y = (clientY - stageY) / scale
        // But we don't have direct ref to stage instance here strictly unless we use useRef for stage.
        // We can use camera state directly.
        // Assuming full screen canvas:
        const x = (e.clientX - camera.x) / camera.zoom;
        const y = (e.clientY - camera.y) / camera.zoom;

        const id = Date.now().toString();
        const baseSize = 60;

        const newElement: any = {
            id,
            type: shapeType, // e.g., 'clean_square'
            x: x - baseSize / 2, // Center on drop
            y: y - baseSize / 2,
            width: baseSize,
            height: baseSize,
            stroke: strokeColor,
            style: 'clean' // Flag to render differently
        };

        addElement(newElement);
        sendMessage([...elements, newElement]);
        saveSnapshot();
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (tool === 'selection') {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const [isDrawing, setIsDrawing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);
    const [lastDist, setLastDist] = useState<number | null>(null); // For pinch zoom


    // Text Input Modal State
    const [isTextModalOpen, setIsTextModalOpen] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [textPosition, setTextPosition] = useState<{ x: number, y: number } | null>(null);

    // Laser Pointer State
    const [laserPoints, setLaserPoints] = useState<number[]>([]);
    const [laserOpacity, setLaserOpacity] = useState(1);
    const laserFadeRef = useRef<number | null>(null);
    const lastPointerPos = useRef<{ x: number, y: number } | null>(null);

    // Coordinate Conversion: Screen (Pointer) -> World (Canvas)
    const getPointerPosition = (stage: any) => {
        const pointer = stage.getPointerPosition();
        if (!pointer) return null;
        return {
            x: (pointer.x - camera.x) / camera.zoom,
            y: (pointer.y - camera.y) / camera.zoom,
        };
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const scaleBy = 1.1;
        const oldScale = camera.zoom;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - camera.x) / oldScale,
            y: (pointer.y - camera.y) / oldScale,
        };

        const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
        performZoom(newScale, pointer, mousePointTo);
    };

    const performZoom = (newScale: number, center: { x: number, y: number }, pointTo: { x: number, y: number }) => {
        // Limit zoom
        if (newScale < 0.1 || newScale > 5) return;

        setCamera({
            zoom: newScale,
            x: center.x - pointTo.x * newScale,
            y: center.y - pointTo.y * newScale,
        });
    }

    const getDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    const getCenter = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
        };
    }


    const isWithinElement = (x: number, y: number, element: any) => {
        const { x: ex, y: ey, width, height, type, points } = element;
        if (type === 'line' || type === 'arrow') {
            const [x1, y1, x2, y2] = points;
            // Improved line hit detection not implemented for brevity, using simple bounding box for now or implementation detail
            // For simple approximation:
            const minX = Math.min(ex + x1, ex + x2);
            const maxX = Math.max(ex + x1, ex + x2);
            const minY = Math.min(ey + y1, ey + y2);
            const maxY = Math.max(ey + y1, ey + y2);
            return x >= minX - 10 && x <= maxX + 10 && y >= minY - 10 && y <= maxY + 10;
        }

        // For shapes (rect, circle, triangle, text) - assume simple bounding box
        // Handle negative width/height
        const absX = width < 0 ? ex + width : ex;
        const absY = height < 0 ? ey + height : ey;
        const absW = Math.abs(width);
        const absH = Math.abs(height);

        return x >= absX && x <= absX + absW && y >= absY && y <= absY + absH;
        return x >= absX && x <= absX + absW && y >= absY && y <= absY + absH;
    };

    const handleTextSubmit = () => {
        if (!textInput || !textPosition) {
            setIsTextModalOpen(false);
            return;
        }
        saveSnapshot();
        const id = Date.now().toString();
        const newElement: any = {
            id,
            type: 'text',
            x: textPosition.x,
            y: textPosition.y,
            text: textInput,
            stroke: strokeColor,
            fontSize: 24,
            width: textInput.length * 15, // Approximate width
            height: 30, // Approximate height for fontSize 24
        };
        addElement(newElement);
        sendMessage([...elements, newElement]);
        setIsTextModalOpen(false);
        setTextInput('');
        setTextPosition(null);
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {

        const stage = e.target.getStage();

        const pos = getPointerPosition(stage);
        if (!pos) return;

        // Pan Logic (Middle Click always pans)
        // Check if it's a mouse event for middle click
        const isMouseEvent = e.evt.type.startsWith('mouse');
        const isMiddleClick = isMouseEvent && (e.evt as MouseEvent).button === 1;

        if (isMiddleClick) {
            setIsPanning(true);
            return;
        }

        // Selection Logic
        if (tool === 'selection') {
            // Check if clicking a resize handle (if any element selected)
            if (selectedElementId && resizeHandle) {
                setIsResizing(true);
                saveSnapshot();
                return;
            }

            // Hit detection for elements (reverse iterate to select top-most)
            let clickedElementId = null;
            for (let i = elements.length - 1; i >= 0; i--) {
                if (isWithinElement(pos.x, pos.y, elements[i])) {
                    clickedElementId = elements[i].id;
                    break;
                }
            }

            if (clickedElementId) {
                selectElement(clickedElementId);
                const element = elements.find(el => el.id === clickedElementId);
                // Initialize drag
                setIsDragging(true);
                setDragOffset({
                    x: pos.x - element.x,
                    y: pos.y - element.y
                });
                saveSnapshot(); // Save before move
            } else {
                // Background click
                selectElement(null);
                setIsPanning(true); // Dragging on empty space pans
                // Store initial pointer pos for touch panning
                const evt = e.evt;
                if (evt.type === 'touchstart') {
                    const touch = (evt as TouchEvent).touches[0];
                    lastPointerPos.current = { x: touch.clientX, y: touch.clientY };
                }
            }
            return;
        }

        if (tool === 'laser') {
            setIsDrawing(true);
            setLaserPoints([pos.x, pos.y]);
            setLaserOpacity(1);
            return;
        }

        selectElement(null); // Clear selection when drawing new shapes

        // Text Tool Logic
        if (tool === 'text') {
            setTextPosition({ x: pos.x, y: pos.y });
            setIsTextModalOpen(true);
            return;
        }

        setIsDrawing(true);
        saveSnapshot(); // Save history before adding
        const id = Date.now().toString();

        let newElement: any = {
            id,
            type: tool,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            stroke: strokeColor,
        };

        if (tool === 'line' || tool === 'arrow') {
            newElement = { ...newElement, points: [0, 0, 0, 0] };
        }

        addElement(newElement);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        const stage = e.target.getStage();

        // Touch: Handle Pinch Zoom
        if (e.evt.type === 'touchmove') {
            const touchEvt = e.evt as TouchEvent;
            if (touchEvt.touches.length === 2) {
                // Multi-touch: Pinch Zoom
                const p1 = { x: touchEvt.touches[0].clientX, y: touchEvt.touches[0].clientY };
                const p2 = { x: touchEvt.touches[1].clientX, y: touchEvt.touches[1].clientY };

                const dist = getDistance(p1, p2);

                if (!lastDist) {
                    setLastDist(dist);
                }

                const pointTo = {
                    x: (getCenter(p1, p2).x - camera.x) / camera.zoom,
                    y: (getCenter(p1, p2).y - camera.y) / camera.zoom,
                };

                const scale = dist / (lastDist || dist);
                const newScale = camera.zoom * scale;

                performZoom(newScale, getCenter(p1, p2), pointTo);
                setLastDist(dist);
                return;
            }
        }

        const pos = getPointerPosition(stage);
        if (!pos) return;

        // Handle Resize Cursor
        if (tool === 'selection' && selectedElementId && !isPanning && !isResizing && !isDragging) {
            // Logic to check if hovering over handles to change cursor
            // (Simplified: just default for now or implement collision check for handles)
        }

        if (isPanning) {
            // Mouse panning uses movementX/Y, Touch needs manual calculation
            const evt = e.evt;
            let dx = 0;
            let dy = 0;

            if (evt.type === 'touchmove') {
                const touch = (evt as TouchEvent).touches[0];
                const currentPos = { x: touch.clientX, y: touch.clientY };

                // If we have a previous position tracked in a ref (we need to track it)
                // Re-using dragOffset for panning start point might be tricky if we want delta
                // Let's use a new ref or just use the dragOffset/lastDist equivalent logic
                // Actually, simpler approach:
                // We can use the existing 'dragOffset' or create a 'lastPanPosition' ref.
                // But wait, the existing logic relied entirely on movementX.

                // Let's deduce dx/dy from last position.
                // We need to store last Touch position.
                if (lastPointerPos.current) {
                    dx = currentPos.x - lastPointerPos.current.x;
                    dy = currentPos.y - lastPointerPos.current.y;
                }
                lastPointerPos.current = currentPos;
            } else if ('movementX' in evt) {
                dx = (evt as MouseEvent).movementX;
                dy = (evt as MouseEvent).movementY;
            }

            const newPos = {
                x: camera.x + dx,
                y: camera.y + dy,
                zoom: camera.zoom
            };
            setCamera(newPos);
            return;
        }

        // Dragging Logic
        if (isDragging && selectedElementId && dragOffset) {
            const index = elements.findIndex(el => el.id === selectedElementId);
            if (index !== -1) {
                const element = elements[index];
                const updatedElement = {
                    ...element,
                    x: pos.x - dragOffset.x,
                    y: pos.y - dragOffset.y
                };
                updateElement(index, updatedElement);
            }
            return;
        }

        if (isResizing && selectedElementId) {
            const index = elements.findIndex(el => el.id === selectedElementId);
            if (index !== -1) {
                const element = elements[index];

                // Simple resizing logic (bottom-right handle only for MVP or map handles)
                // Assuming 'br' handle for simplicity if resizeHandle implementation is complex inside this block
                // Let's implement full handle support if possible, or just drag bottom-right

                let updatedElement = { ...element };

                if (['rectangle', 'circle', 'triangle'].includes(element.type)) {
                    if (resizeHandle === 'br') {
                        updatedElement.width = pos.x - element.x;
                        updatedElement.height = pos.y - element.y;
                    } else if (resizeHandle === 'tr') {
                        updatedElement.width = pos.x - element.x;
                        updatedElement.height = element.height + (element.y - pos.y);
                        updatedElement.y = pos.y;
                    }
                    // Add other handles as needed
                } else if (element.type === 'text') {
                    if (resizeHandle === 'br' || resizeHandle === 'se') {
                        updatedElement.width = pos.x - element.x;
                        updatedElement.height = pos.y - element.y;
                        // Scale font size based on height (approximate ratio)
                        updatedElement.fontSize = Math.max(12, Math.abs(updatedElement.height) * 0.8);
                    }
                }
                // For simplified specific request: just "resize", assume dragging creates new size from origin
                // If we want proper handle support, we need to know WHICH handle caused the drag.
                // Re-using logic: if we clicked a handle, we are resizing.
                // Implementing basic bottom-right resize for now
                if (resizeHandle === 'br' || resizeHandle === 'se') {
                    updatedElement.width = pos.x - element.x;
                    updatedElement.height = pos.y - element.y;
                }

                updateElement(index, updatedElement);
            }
            return;
        }

        if (!isDrawing) return;

        if (tool === 'laser') {
            setLaserPoints([...laserPoints, pos.x, pos.y]);
            setLaserOpacity(1);
            return;
        }

        const index = elements.length - 1;
        if (index < 0) return;

        const element = elements[index];
        const { x, y } = element; // Start position (World Coords)

        let updatedElement = { ...element };

        if (['rectangle', 'circle', 'triangle'].includes(tool)) {
            updatedElement.width = pos.x - x;
            updatedElement.height = pos.y - y;
        } else if (tool === 'line' || tool === 'arrow') {
            updatedElement.points = [0, 0, pos.x - x, pos.y - y];
        }

        updateElement(index, updatedElement);
    };

    const handleMouseUp = () => {
        setLastDist(null); // Reset pinch zoom
        if (isDrawing || isResizing || isDragging) {
            sendMessage(elements);
        }
        setIsDrawing(false);
        setIsPanning(false);
        setIsResizing(false);
        setIsDragging(false);
        setIsDragging(false);
        setResizeHandle(null);
        setDragOffset(null);
        lastPointerPos.current = null;

        if (tool === 'laser') {
            startLaserFade();
        }
    };

    const startLaserFade = () => {
        let opacity = 1;
        const fade = () => {
            opacity -= 0.05;
            if (opacity <= 0) {
                setLaserPoints([]);
                setLaserOpacity(0);
                if (laserFadeRef.current) cancelAnimationFrame(laserFadeRef.current);
            } else {
                setLaserOpacity(opacity);
                laserFadeRef.current = requestAnimationFrame(fade);
            }
        };
        laserFadeRef.current = requestAnimationFrame(fade);
    };

    useEffect(() => {
        return () => {
            if (laserFadeRef.current) cancelAnimationFrame(laserFadeRef.current);
        };
    }, []);

    // Helper to render selection handle (Resize Box)
    const renderSelectionBox = (element: any) => {
        if (!element || element.type === 'line' || element.type === 'arrow') return null; // Resizing lines harder, skip for now

        const { x, y, width, height } = element;
        // Normalize rect for negative width/height
        const absX = width < 0 ? x + width : x;
        const absY = height < 0 ? y + height : y;
        const absW = Math.abs(width);
        const absH = Math.abs(height);

        return (
            <React.Fragment>
                {/* Border */}
                <KonvaLine
                    points={[absX, absY, absX + absW, absY, absX + absW, absY + absH, absX, absY + absH, absX, absY]}
                    stroke="#3b82f6"
                    strokeWidth={1}
                    listening={false}
                />
                {/* Bottom-Right Handle */}
                <Ellipse
                    x={absX + absW}
                    y={absY + absH}
                    radiusX={5}
                    radiusY={5}
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth={2}
                    onMouseDown={(e) => {
                        e.cancelBubble = true;
                        setResizeHandle('br');
                        setIsResizing(true);
                        saveSnapshot();
                    }}
                    onMouseEnter={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'nwse-resize';
                    }}
                    onMouseLeave={(e) => {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = 'default';
                    }}
                />
            </React.Fragment>
        );
    };

    const selectedElement = elements.find(el => el.id === selectedElementId);

    return (
        <>
            <div
                className="w-full h-full"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <Stage
                    width={window.innerWidth}
                    height={window.innerHeight}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                    onWheel={handleWheel}
                    scaleX={camera.zoom}
                    scaleY={camera.zoom}
                    x={camera.x}
                    y={camera.y}
                    className="bg-gray-50 cursor-crosshair"
                >
                    <Layer>
                        {elements.map((element) => {
                            // Highlight if selected
                            const isSelected = element.id === selectedElementId;

                            if (element.type === 'text') {
                                return (
                                    <Text
                                        key={element.id}
                                        x={element.x}
                                        y={element.y}
                                        text={element.text}
                                        fontSize={element.fontSize || 24}
                                        width={element.width}
                                        fontFamily='"Patrick Hand", cursive'
                                        fill={element.stroke}
                                        opacity={isSelected ? 0.7 : 1}
                                        listening={false}
                                    />
                                );
                            }

                            if (element.style === 'clean' || element.type.startsWith('clean_')) {
                                return <CleanShape key={element.id} element={element} selected={isSelected} />;
                            }

                            return <RoughShape key={element.id} element={element} selected={isSelected} />;
                        })}

                        {/* Render Selection UI on top */}
                        {selectedElement && renderSelectionBox(selectedElement)}

                        {laserPoints.length > 0 && (
                            <KonvaLine
                                points={laserPoints}
                                stroke="#ef4444"
                                strokeWidth={4 / camera.zoom}
                                lineCap="round"
                                lineJoin="round"
                                opacity={laserOpacity}
                                listening={false}
                            />
                        )}
                    </Layer>
                </Stage>
            </div>

            <Modal
                isOpen={isTextModalOpen}
                title="Add Text"
                onConfirm={handleTextSubmit}
                onCancel={() => { setIsTextModalOpen(false); setTextInput(''); }}
                confirmText="Add"
                cancelText="Cancel"
                type="input"
            >
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">Content</label>
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }}
                        autoFocus
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Type something..."
                    />
                </div>
            </Modal>
        </>
    );
};

const CleanShape = ({ element, selected }: { element: any, selected: boolean }) => {
    const { type, x, y, width, height, stroke = '#000000' } = element;
    const props = {
        x, y, width, height,
        stroke: stroke,
        strokeWidth: 2,
        fill: 'transparent',
        opacity: selected ? 0.8 : 1, // Visual feedback for selection if needed, handle is main feedback
        listening: false
    };

    // Handle resizing logic: Konva shapes often use scale or direct width/height.
    // Our primitive resize logic updates width/height directly.

    // Normalized dimensions for rendering inside x,y
    const absW = Math.abs(width);
    const absH = Math.abs(height);
    const finalX = width < 0 ? x + width : x;
    const finalY = height < 0 ? y + height : y;

    // Helper for centering paths
    // We scale paths to fit the box. Standard icon viewport 24x24.
    const scaleX = absW / 24;
    const scaleY = absH / 24;

    switch (type) {
        // --- Geometric ---
        case 'clean_square':
        case 'clean_rounded_rect':
            return <Rect {...props} x={finalX} y={finalY} width={absW} height={absH} cornerRadius={type === 'clean_rounded_rect' ? Math.min(absW, absH) * 0.2 : 0} />;

        case 'clean_circle':
            return <Ellipse {...props} x={finalX + absW / 2} y={finalY + absH / 2} radiusX={absW / 2} radiusY={absH / 2} />;

        case 'clean_triangle':
            return <KonvaLine {...props} x={0} y={0} points={[finalX + absW / 2, finalY, finalX, finalY + absH, finalX + absW, finalY + absH]} closed />;

        case 'clean_diamond':
            return <KonvaLine {...props} x={0} y={0} points={[finalX + absW / 2, finalY, finalX + absW, finalY + absH / 2, finalX + absW / 2, finalY + absH, finalX, finalY + absH / 2]} closed />;

        case 'clean_parallelogram':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW * 0.25, finalY,
                finalX + absW, finalY,
                finalX + absW * 0.75, finalY + absH,
                finalX, finalY + absH
            ]} closed />;

        case 'clean_hexagon':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW * 0.25, finalY,
                finalX + absW * 0.75, finalY,
                finalX + absW, finalY + absH * 0.5,
                finalX + absW * 0.75, finalY + absH,
                finalX + absW * 0.25, finalY + absH,
                finalX, finalY + absH * 0.5
            ]} closed />;

        case 'clean_octagon':
            const s = 0.3; // indent factor
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW * s, finalY,
                finalX + absW * (1 - s), finalY,
                finalX + absW, finalY + absH * s,
                finalX + absW, finalY + absH * (1 - s),
                finalX + absW * (1 - s), finalY + absH,
                finalX + absW * s, finalY + absH,
                finalX, finalY + absH * (1 - s),
                finalX, finalY + absH * s
            ]} closed />;

        case 'clean_cylinder':
        case 'clean_database': // Database is often just a cylinder
            // database/cylinder: Two ellipses connected by lines.
            // Top Ellipse
            return (
                <>
                    <Ellipse {...props} x={finalX + absW / 2} y={finalY + absH * 0.15} radiusX={absW / 2} radiusY={absH * 0.15} />
                    <Path {...props} x={finalX} y={finalY} scaleX={1} scaleY={1}
                        data={`M0,${absH * 0.15} v${absH * 0.7} a${absW / 2},${absH * 0.15} 0 0,0 ${absW},0 v-${absH * 0.7}`} />
                    {type === 'clean_database' && (
                        // Extra lines for DB layers
                        <Path {...props} x={finalX} y={finalY} scaleX={1} scaleY={1} strokeWidth={1}
                            data={`M0,${absH * 0.4} a${absW / 2},${absH * 0.15} 0 0,0 ${absW},0 M0,${absH * 0.65} a${absW / 2},${absH * 0.15} 0 0,0 ${absW},0`} />
                    )}
                </>
            );

        // --- Arrows ---
        case 'clean_arrow_right':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX, finalY + absH * 0.25,
                finalX + absW * 0.5, finalY + absH * 0.25,
                finalX + absW * 0.5, finalY,
                finalX + absW, finalY + absH * 0.5,
                finalX + absW * 0.5, finalY + absH,
                finalX + absW * 0.5, finalY + absH * 0.75,
                finalX, finalY + absH * 0.75
            ]} closed />;

        case 'clean_arrow_left':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW, finalY + absH * 0.25,
                finalX + absW * 0.5, finalY + absH * 0.25,
                finalX + absW * 0.5, finalY,
                finalX, finalY + absH * 0.5,
                finalX + absW * 0.5, finalY + absH,
                finalX + absW * 0.5, finalY + absH * 0.75,
                finalX + absW, finalY + absH * 0.75
            ]} closed />;

        case 'clean_arrow_up':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW * 0.25, finalY + absH,
                finalX + absW * 0.25, finalY + absH * 0.5,
                finalX, finalY + absH * 0.5,
                finalX + absW * 0.5, finalY,
                finalX + absW, finalY + absH * 0.5,
                finalX + absW * 0.75, finalY + absH * 0.5,
                finalX + absW * 0.75, finalY + absH
            ]} closed />;

        case 'clean_arrow_down':
            return <KonvaLine {...props} x={0} y={0} points={[
                finalX + absW * 0.25, finalY,
                finalX + absW * 0.25, finalY + absH * 0.5,
                finalX, finalY + absH * 0.5,
                finalX + absW * 0.5, finalY + absH,
                finalX + absW, finalY + absH * 0.5,
                finalX + absW * 0.75, finalY + absH * 0.5,
                finalX + absW * 0.75, finalY
            ]} closed />;


        // --- Symbols / Icons (Using Paths) ---
        case 'clean_star':
            return <Star x={finalX + absW / 2} y={finalY + absH / 2} numPoints={5} innerRadius={Math.min(absW, absH) * 0.2} outerRadius={Math.min(absW, absH) * 0.5} stroke={stroke} strokeWidth={2} fill="transparent" listening={false} />;

        case 'clean_heart':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />;

        case 'clean_cloud':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M17.5 19c2.485 0 4.5-2.015 4.5-4.5s-2.015-4.5-4.5-4.5c-.4 0-.77.06-1.12.18-.78-2.9-3.37-5.06-6.38-5.06-3.66 0-6.63 2.87-6.86 6.5C1.34 11.96 0 13.8 0 16c0 2.76 2.24 5 5 5h12.5z" />;

        case 'clean_message':
            // Message Circle / Bubble
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />;

        case 'clean_file':
            // File Icon
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z M14 2v6h6" />;

        case 'clean_folder':
            // Folder Icon
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />;

        case 'clean_user':
            // User Icon
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />;

        case 'clean_lock':
            // Simple Lock: Body + Shackle
            return (
                <>
                    {/* Body */}
                    <Rect {...props} x={finalX} y={finalY + absH * 0.4} width={absW} height={absH * 0.6} cornerRadius={2} />
                    {/* Shackle */}
                    <Path {...props} x={finalX} y={finalY} scaleX={1} scaleY={1} fill="transparent"
                        data={`M${absW * 0.2},${absH * 0.4} V${absH * 0.25} a${absW * 0.3},${absW * 0.3} 0 0,1 ${absW * 0.6},0 V${absH * 0.4}`} />
                </>
            );

        case 'clean_unlock':
            // Unlock: Shackle is raised/offset and open
            return (
                <>
                    {/* Body */}
                    <Rect {...props} x={finalX} y={finalY + absH * 0.4} width={absW} height={absH * 0.6} cornerRadius={2} />
                    {/* Shackle (Open) */}
                    <Path {...props} x={finalX} y={finalY} scaleX={1} scaleY={1} fill="transparent"
                        data={`M${absW * 0.8},${absH * 0.4} V${absH * 0.25} a${absW * 0.3},${absW * 0.3} 0 0,0 -${absW * 0.6},0 V${absH * 0.2}`} />
                </>
            );

        case 'clean_calendar':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18" />;

        case 'clean_clock':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2" />;

        case 'clean_check':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />;

        case 'clean_cross':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M18 6L6 18 M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />;

        case 'clean_alert':
            // Alert: Triangle with Exclamation Mark !
            return (
                <>
                    <KonvaLine {...props} x={0} y={0} points={[finalX + absW / 2, finalY, finalX, finalY + absH, finalX + absW, finalY + absH]} closed />
                    {/* Exclamation Mark: Line + Dot */}
                    <KonvaLine {...props} x={0} y={0} points={[finalX + absW / 2, finalY + absH * 0.35, finalX + absW / 2, finalY + absH * 0.65]} strokeWidth={Math.max(2, absW * 0.08)} strokeLineCap="round" />
                    <Ellipse {...props} x={finalX + absW / 2} y={finalY + absH * 0.80} radiusX={absW * 0.05} radiusY={absW * 0.05} fill={stroke} strokeWidth={0} />
                </>
            );

        case 'clean_info':
            // Info: Circle with Lowercase i
            return (
                <>
                    <Ellipse {...props} x={finalX + absW / 2} y={finalY + absH / 2} radiusX={absW / 2} radiusY={absH / 2} />
                    {/* Lowercase i: Dot + Line */}
                    <Ellipse {...props} x={finalX + absW / 2} y={finalY + absH * 0.3} radiusX={absW * 0.05} radiusY={absW * 0.05} fill={stroke} strokeWidth={0} />
                    <KonvaLine {...props} x={0} y={0} points={[finalX + absW / 2, finalY + absH * 0.45, finalX + absW / 2, finalY + absH * 0.75]} strokeWidth={Math.max(2, absW * 0.08)} strokeLineCap="round" />
                </>
            );

        case 'clean_plus':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M12 5v14 M5 12h14" strokeLinecap="round" />;

        case 'clean_minus':
            return <Path {...props} x={finalX} y={finalY} scaleX={scaleX} scaleY={scaleY} data="M5 12h14" strokeLinecap="round" />;

        // Default fallback
        default:
            return <Rect {...props} x={finalX} y={finalY} width={absW} height={absH} cornerRadius={2} />;
    }
}

const RoughShape = (props: { element: any, selected?: boolean }) => {
    const { element } = props;
    const { type, x, y, width, height, points, stroke = '#000000' } = element;
    const [paths, setPaths] = useState<any[]>([]);

    useEffect(() => {
        // Skip invisible shapes
        if ((type !== 'line' && type !== 'arrow') && (width === 0 && height === 0)) return;

        let drawables: any[] = []; // Support multiple primitives per shape
        const options = { stroke, roughness: 1.5, bowing: 1.5 };

        try {
            switch (type) {
                case 'rectangle':
                    drawables.push(generator.rectangle(0, 0, width, height, options));
                    break;
                case 'circle':
                    // Just the rough outline. Background is handled by Konva.Ellipse below.
                    drawables.push(generator.ellipse(width / 2, height / 2, width, height, options));
                    break;
                case 'triangle':
                    // Polygon for triangle
                    const p1 = [width / 2, 0];
                    const p2 = [0, height];
                    const p3 = [width, height];
                    drawables.push(generator.polygon([p1, p2, p3] as any, options));
                    break;
                case 'line':
                    drawables.push(generator.line(points[0], points[1], points[2], points[3], options));
                    break;
                case 'arrow':
                    drawables.push(generator.line(points[0], points[1], points[2], points[3], options));

                    // Arrowhead logic
                    if (points && points.length >= 4) {
                        const [x1, y1, x2, y2] = points;
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        const headLength = 20;
                        const arrowAngle = Math.PI / 6;

                        const x3 = x2 - headLength * Math.cos(angle - arrowAngle);
                        const y3 = y2 - headLength * Math.sin(angle - arrowAngle);
                        drawables.push(generator.line(x2, y2, x3, y3, options));

                        const x4 = x2 - headLength * Math.cos(angle + arrowAngle);
                        const y4 = y2 - headLength * Math.sin(angle + arrowAngle);
                        drawables.push(generator.line(x2, y2, x4, y4, options));
                    }
                    break;
                default:
                    drawables.push(generator.rectangle(0, 0, width, height, options));
                    break;
            }

            if (drawables.length > 0) {
                const roughPaths = drawables.flatMap(d => generator.toPaths(d));
                setPaths(roughPaths);
            }
        } catch (e) {
            console.error("Error generating shape:", e);
        }
    }, [element, type, width, height, stroke, points]);

    return (
        <React.Fragment>
            {/* Render Solid White Background for Circle FIRST (so it's behind) */}
            {type === 'circle' && (
                <Ellipse
                    x={x + width / 2}
                    y={y + height / 2}
                    radiusX={Math.abs(width) / 2}
                    radiusY={Math.abs(height) / 2}
                    fill="#ffffff"
                    listening={false}
                />
            )}

            {/* Render Rough Paths (Outline only, since fill is 'none') */}
            {paths.map((p, i) => (
                <Path
                    key={i}
                    x={x}
                    y={y}
                    data={p.d}
                    stroke={p.stroke}
                    strokeWidth={p.strokeWidth || 1}
                    fill={'transparent'} // Double check to ensure no fill
                    listening={false}
                />
            ))}
        </React.Fragment>
    );
};
