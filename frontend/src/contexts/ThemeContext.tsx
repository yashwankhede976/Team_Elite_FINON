import { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
    isDark: boolean;
    theme: 'dark' | 'light' | 'emerald';
    setTheme: (theme: 'dark' | 'light' | 'emerald') => void;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    isDark: true,
    theme: 'dark',
    setTheme: () => {},
    toggle: () => { },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<'dark' | 'light' | 'emerald'>(() => {
        const stored = localStorage.getItem('finon_theme');
        if (stored === 'light' || stored === 'emerald' || stored === 'dark') return stored as 'dark' | 'light' | 'emerald';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.classList.remove('light', 'emerald');
        if (theme === 'light') {
            document.documentElement.classList.add('light');
        } else if (theme === 'emerald') {
            document.documentElement.classList.add('emerald');
        }
        localStorage.setItem('finon_theme', theme);
    }, [theme]);

    function toggle() {
        setThemeState(t => t === 'dark' ? 'light' : 'dark');
    }

    return (
        <ThemeContext.Provider value={{ isDark: theme === 'dark' || theme === 'emerald', theme, setTheme: setThemeState, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
