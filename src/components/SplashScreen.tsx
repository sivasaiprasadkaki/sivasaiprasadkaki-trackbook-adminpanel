import { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar from 0 to 100 over 1.2 seconds starting after logo lands (at 1.2s)
    const startTime = Date.now() + 1200;
    const duration = 1200; // 1.2 seconds to fill

    const interval = setInterval(() => {
      const now = Date.now();
      if (now < startTime) {
        setProgress(0);
        return;
      }
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        // Delay onComplete slightly for a smooth final transition
        setTimeout(() => {
          onComplete();
        }, 300);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white overflow-hidden font-sans select-none"
      id="login-splash-screen"
    >
      <div className="flex flex-col items-center max-w-2xl w-full px-6 text-center">
        
        {/* LOGO CONTAINER - animate falling with spring bounce, matching the layout of the provided image */}
        <motion.div
          initial={{ y: -250, opacity: 0, scale: 0.9 }}
          animate={{ 
            y: 0, 
            opacity: 1, 
            scale: 1.0,
            boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.15)"
          }}
          transition={{ 
            type: "spring",
            stiffness: 75,
            damping: 13,
            mass: 1.1,
            duration: 1.6
          }}
          className="flex items-center bg-white rounded-3xl border border-slate-100/80 p-8 mb-10"
          id="splash-logo-container"
        >
          {/* TrackBook Shield Logo SVG - High Fidelity Custom Shape */}
          <svg 
            className="w-24 h-24 mr-6 select-none" 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            id="splash-logo-svg"
          >
            <defs>
              <linearGradient id="shieldBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="50%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="trendLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Shield Outline with exact curve and teal-to-blue gradient */}
            <path 
              d="M 50,14 C 65,14 82,19 82,36 C 82,58 50,83 50,83 C 50,83 18,58 18,36 C 18,19 35,14 50,14 Z" 
              stroke="url(#shieldBorderGrad)" 
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Inner dotted shield outline for visual refinement */}
            <path 
              d="M 50,21 C 61,21 73,24 73,37 C 73,53 50,73 50,73 C 50,73 27,53 27,37 C 27,24 39,21 50,21 Z" 
              stroke="#cbd5e1" 
              strokeWidth="1.2"
              strokeDasharray="3 3"
              fill="none"
              opacity="0.5"
            />

            {/* Map Pin inside */}
            <path 
              d="M 50,28 C 42.5,28 36.5,34 36.5,41.5 C 36.5,51.5 50,64 50,64 C 50,64 63.5,51.5 63.5,41.5 C 63.5,34 57.5,28 50,28 Z" 
              fill="url(#pinGrad)" 
              stroke="#ffffff"
              strokeWidth="1.5"
              opacity="0.95"
            />

            {/* User Silhouette inside Pin */}
            <circle cx="50" cy="37.5" r="4.5" fill="#ffffff" />
            <path 
              d="M 42,47.5 C 42,43.5 45.5,42.5 50,42.5 C 54.5,42.5 58,43.5 58,47.5" 
              stroke="#ffffff" 
              strokeWidth="2.2" 
              strokeLinecap="round" 
              fill="none"
            />

            {/* Dynamic rising trend/growth line with loop and arrow */}
            <path 
              d="M 12,54 C 8,43 23,43 24,54 C 25,60 36,52 38,45 L 53,35 L 63,41 L 89,23" 
              stroke="url(#trendLineGrad)" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none"
              filter="url(#glow)"
            />

            {/* Nodes on Trend Line */}
            <circle cx="38" cy="45" r="3" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2" />
            <circle cx="53" cy="35" r="3" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
            <circle cx="63" cy="41" r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />

            {/* Arrowhead pointing up-right */}
            <path 
              d="M 77,23 L 90,22 L 89,35" 
              stroke="url(#trendLineGrad)" 
              strokeWidth="4.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none"
            />
          </svg>

          {/* Text Lockup on the right, fading in after shield lands */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
            className="flex flex-col text-left border-l border-slate-200/80 pl-6"
            id="splash-text-lockup"
          >
            <span className="text-4xl font-extrabold tracking-wide text-[#111827] leading-none">
              TRACKBOOK
            </span>
            <span className="text-xl font-bold tracking-[0.25em] text-[#0891b2] uppercase mt-2 leading-none">
              ADMIN PANEL
            </span>
          </motion.div>
        </motion.div>

        {/* Status Message - Fades in slightly after brand text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="mb-8 h-6"
          id="splash-status-message"
        >
          <p className="text-xs font-semibold text-slate-500 tracking-wide animate-pulse">
            Initializing Secure Admin Workspace...
          </p>
        </motion.div>

        {/* Progress Bar Container */}
        <div 
          className="w-56 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto shadow-inner"
          id="splash-progress-container"
        >
          <motion.div 
            className="h-full bg-blue-600 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeOut" }}
            id="splash-progress-bar"
          />
        </div>

      </div>
    </div>
  );
}
