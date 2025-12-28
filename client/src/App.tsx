import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'
import { Header } from './components/Header'
import { ColorPalette } from './components/ColorPalette'
import { useAutoSave } from './hooks/useAutoSave'
import { useStore } from './store'
import { useEffect } from 'react'

function App() {
  useAutoSave();
  const { undo, redo } = useStore();

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-gray-50">
      <Header />
      <Canvas />
      <Toolbar />
      <ColorPalette />
      <div className="absolute top-4 right-4 pointer-events-none select-none bg-white/50 p-2 rounded text-xs text-gray-500">
        clonet1 dev preview (M5 - Polished)
      </div>
    </div>
  )
}

export default App
