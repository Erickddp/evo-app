import { useState, useEffect } from 'react';

const STORAGE_KEY = 'evorix.sidebarState';
const MOBILE_BREAKPOINT = 768;

export function useSidebarState() {
    // Initialize to collapsed (true) by default, ignoring localStorage for initial state
    const [isCollapsed, setIsCollapsed] = useState(true);

    const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < MOBILE_BREAKPOINT;
            setIsMobile(mobile);
            if (!mobile) {
                setIsMobileOpen(false); // Reset mobile open state when switching to desktop
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleSidebar = () => {
        if (isMobile) {
            setIsMobileOpen(!isMobileOpen);
        } else {
            const newState = !isCollapsed;
            setIsCollapsed(newState);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
        }
    };

    const closeMobileSidebar = () => {
        if (isMobile) {
            setIsMobileOpen(false);
        }
    };

    return {
        isCollapsed,
        isMobile,
        isMobileOpen,
        toggleSidebar,
        closeMobileSidebar
    };
}
