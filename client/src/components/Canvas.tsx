import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Path, Line as KonvaLine, Text, Ellipse } from 'react-konva';
import rough from 'roughjs';
import Konva from 'konva';
import { useStore } from '../store';
import { useWebSocket } from '../hooks/useWebSocket';
import { Modal } from './Modal';

const generator = rough.generator();

export const Canvas = () => {
    const { tool, elements, addElement, updateElement, camera, setCamera, saveSnapshot, selectedElementId, selectElement, strokeColor } = useStore();
    const { sendMessage } = useWebSocket();
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
        const isMiddleClick = e.evt.button === 1;
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
            const newPos = {
                x: camera.x + e.evt.movementX,
                y: camera.y + e.evt.movementY,
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
        setResizeHandle(null);
        setDragOffset(null);

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
