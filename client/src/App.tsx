import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'
import { Header } from './components/Header'
import { ColorPalette } from './components/ColorPalette'
import { Sidebar } from './components/Sidebar'

import { useAutoSave } from './hooks/useAutoSave'
import { useStore } from './store'
import { useWebSocket } from './hooks/useWebSocket'
import { useEffect } from 'react'


function App() {
  useAutoSave();
  const { undo, redo, elements, setElements, selectedElementId, selectElement, saveSnapshot } = useStore();
  const { sendMessage } = useWebSocket();


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Cmd+Y OR Ctrl+Shift+Z or Cmd+Shift+Z
      else if (
        ((e.metaKey || e.ctrlKey) && e.key === 'y') ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        redo();
      }
      // Delete: Delete or Backspace (if not in input)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementId) {
        // Prevent delete if user is typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        saveSnapshot();
        const newElements = elements.filter(el => el.id !== selectedElementId);
        setElements(newElements);
        sendMessage(newElements);
        selectElement(null);
      }
    };


    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, elements, selectedElementId, setElements, selectElement, saveSnapshot, sendMessage]);


  return (
    <div className="w-screen h-screen overflow-hidden relative bg-gray-50" style={{ touchAction: 'none' }}>
      <Header />
      <Canvas />
      <Toolbar />
      <ColorPalette />
      <Sidebar />
      <div className="absolute top-4 right-4 pointer-events-none select-none bg-white/50 p-2 rounded text-xs text-gray-500">
        clonet1 dev preview (M5 - Polished)
      </div>
    </div>
  )
}

export default App
