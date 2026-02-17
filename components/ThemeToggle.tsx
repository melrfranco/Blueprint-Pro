import React, { useEffect, useState } from 'react';
import { Toggle } from './Toggle';

const STORAGE_KEY = 'admin_theme';

const ThemeToggle: React.FC = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const stored = localStorage.getItem(STORAGE_KEY);
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
        const shouldDark = stored ? stored === 'dark' : !!prefersDark;

        setIsDark(shouldDark);
        document.documentElement.classList.toggle('dark', shouldDark);
    }, []);

    const handleChange = (checked: boolean) => {
        setIsDark(checked);
        document.documentElement.classList.toggle('dark', checked);
        localStorage.setItem(STORAGE_KEY, checked ? 'dark' : 'light');
    };

    return (
        <div className="flex items-center justify-between">
            <span className="bp-body-sm text-muted-foreground">Dark mode</span>
            <Toggle checked={isDark} onCheckedChange={handleChange} data-ui="toggle" />
        </div>
    );
};

export default ThemeToggle;
