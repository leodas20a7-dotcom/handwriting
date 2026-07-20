import { useState } from 'react'
import HandwritingGenerator from './components/HandwritingGenerator'

function App() {
  const [isDark, setIsDark] = useState(true);

  return (
    <div className={`${isDark ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] text-gray-900 dark:text-white flex flex-col justify-center py-0 sm:py-12 relative overflow-hidden transition-colors duration-500">
        {/* Animated Mesh Gradient Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] animate-mesh pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/20 blur-[120px] animate-mesh pointer-events-none" style={{ animationDelay: '-5s' }}></div>
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[100px] animate-mesh pointer-events-none" style={{ animationDelay: '-10s' }}></div>
        
        {/* Subtle overlay grid for texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] dark:opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
        
        <div className="relative z-10">
          <HandwritingGenerator isDark={isDark} setIsDark={setIsDark} />
        </div>
      </div>
    </div>
  )
}

export default App
