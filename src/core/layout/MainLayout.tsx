import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function MainLayout() {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />

                <main className="flex-1 overflow-auto p-6">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
