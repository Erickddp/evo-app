import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSidebarState } from './useSidebarState';
import { PageTransition } from './PageTransition';
import { SaveBar } from '../../modules/core/sync/SaveBar';
import { ProfileWelcomeToast } from '../../modules/core/profiles/ProfileWelcomeToast';

import { useProfile } from '../../modules/core/profiles/ProfileProvider';

export function MainLayout() {
    const { isCollapsed, isMobile, isMobileOpen, toggleSidebar, closeMobileSidebar } = useSidebarState();
    const { activeProfile } = useProfile();

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
            <Sidebar
                isCollapsed={isCollapsed}
                isMobile={isMobile}
                isOpen={isMobileOpen}
                toggleSidebar={toggleSidebar}
                closeMobileSidebar={closeMobileSidebar}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar toggleSidebar={toggleSidebar} />

                <main className="flex-1 overflow-auto p-6">
                    <div className="max-w-7xl mx-auto">
                        <PageTransition key={activeProfile?.id || 'default-profile'}>
                            <Outlet />
                        </PageTransition>
                    </div>
                </main>
            </div>
            {SHOW_LEGACY_SYNC_BAR && <SaveBar />}
            <ProfileWelcomeToast />
        </div>
    );
}

const SHOW_LEGACY_SYNC_BAR = false;
