import React from 'react';

interface ThemeToggleProps {
    isDark: boolean;
    toggleTheme: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDark, toggleTheme }) => (
    <div className="fixed bottom-4 left-4 z-50">
        <button 
            className="p-2 bg-slate-800 text-white dark:bg-white dark:text-slate-800 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform" 
            onClick={toggleTheme}
            aria-label="Toggle Theme"
        >
            <span className="material-symbols-outlined">
                {isDark ? 'light_mode' : 'dark_mode'}
            </span>
        </button>
    </div>
);

export default ThemeToggle;