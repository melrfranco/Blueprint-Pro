import React, { useEffect, useState } from 'react';

export const useSaveToast = () => {
    const [toastVisible, setToastVisible] = useState(false);

    const showToast = () => setToastVisible(true);
    const hideToast = () => setToastVisible(false);

    return { toastVisible, showToast, hideToast };
};

type SaveToastProps = {
    visible: boolean;
    onDone?: () => void;
    message?: string;
};

export const SaveToast: React.FC<SaveToastProps> = ({
    visible,
    onDone,
    message = 'Saved',
}) => {
    useEffect(() => {
        if (!visible) return;

        const timer = window.setTimeout(() => {
            onDone?.();
        }, 2000);

        return () => window.clearTimeout(timer);
    }, [visible, onDone]);

    if (!visible) return null;

    return (
        <div
            className="fixed bottom-6 right-6 z-50 rounded-full bg-card text-foreground border border-border px-5 py-2 shadow-lg"
            role="status"
            aria-live="polite"
        >
            <span className="text-sm font-semibold">{message}</span>
        </div>
    );
};
