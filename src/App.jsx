import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import StoryGenerator from './components/StoryGenerator'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <h1 className="heading-1 text-center mb-2">
            AI Story Generator
          </h1>
          <p className="text-center text-lg text-slate-600">
            Create unique stories with artificial intelligence
          </p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-12">
        <StoryGenerator />
      </main>
      
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <p className="text-center text-slate-500">
            Powered by Google Gemini AI
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
