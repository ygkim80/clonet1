import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

export const useWebSocket = () => {
    const socketRef = useRef<WebSocket | null>(null);
    const { setElements } = useStore();

    useEffect(() => {
        // Dynamic WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = import.meta.env.DEV ? 'localhost:8000' : window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
            console.log('WebSocket connected');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'sync' && Array.isArray(data.elements)) {
                    // Update store with received elements
                    // "Last write wins" - just replace the state
                    setElements(data.elements);
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket disconnected');
        };

        return () => {
            socket.close();
        };
    }, [setElements]);

    const sendMessage = useCallback((elements: any[]) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                type: 'sync',
                elements: elements
            }));
        }
    }, []);

    return { sendMessage };
};
