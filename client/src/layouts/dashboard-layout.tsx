import { useState, ReactNode } from 'react';
import Sidebar from '@/components/sidebar';
import Header from '@/components/header';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
      
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-56'}`}>
        {/* Top Bar */}
        <Header />
        
        {/* Content */}
        <main className="bg-[#F5F7FA] min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
