import React from 'react';
import { HomeIcon, DocumentTextIcon, SettingsIcon } from './icons';

export type Tab = 'dashboard' | 'plans' | 'settings';

interface BottomNavProps {
    activeTab: string;
    onChange: (tab: Tab) => void;
}

const NAV_ITEMS: { key: Tab; label: string; icon: any }[] = [
    { key: 'dashboard', label: 'Home', icon: HomeIcon },
    { key: 'plans', label: 'Plans', icon: DocumentTextIcon },
    { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function BottomNav({ activeTab, onChange }: BottomNavProps) {

    return (
        <nav className="fixed bottom-0 inset-x-0 z-50 bp-bottomnav">
            <div className="flex justify-around max-w-md mx-auto p-2 pb-6 pt-3">
                {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
                    const isActive = activeTab === key;

                    return (
                        <button
                            key={key}
                            onClick={() => onChange(key)}
                            className="bp-bottomnav-item flex flex-col items-center justify-center w-full p-1 transition-all"
                            aria-label={label}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon className="bp-bottomnav-icon h-7 w-7 mb-1" />
                            <span className="bp-bottomnav-label">
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}