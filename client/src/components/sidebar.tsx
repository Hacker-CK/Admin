import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Receipt,
  Wifi,
  Share2,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const [location] = useLocation();

  const isLinkActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const sidebarLinks = [
    {
      group: "Main Menu",
      links: [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/users", label: "Users", icon: Users },
        { href: "/transactions", label: "Transactions", icon: Receipt },
        { href: "/operators", label: "Operators", icon: Wifi },
        { href: "/referrals", label: "Referrals", icon: Share2 },
        { href: "/notifications", label: "Notifications", icon: Bell },
      ],
    },
    {
      group: "System",
      links: [
        { href: "/settings", label: "Settings", icon: Settings },
        {
          href: "/logout",
          label: "Logout",
          icon: LogOut,
          className: "text-red-500",
        },
      ],
    },
  ];

  const handleLogout = (e: React.MouseEvent) => {
    if (e.currentTarget.getAttribute("href") === "/logout") {
      e.preventDefault();
      localStorage.removeItem("isLoggedIn");
      window.location.href = "/login";
    }
  };

  return (
    <div
      className={cn(
        "bg-white shadow-md fixed top-0 left-0 z-10 h-full transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      {/* Logo and Collapse Button */}
      <div className={cn("py-4 flex items-center border-b border-gray-100", collapsed ? "px-2 justify-center" : "px-4 justify-between")}>
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center text-white font-bold shadow-md">
            <span className="text-sm tracking-wide">RB</span>
          </div>
          {!collapsed && (
            <div className="ml-2">
              <span className="font-semibold text-base tracking-tight">Billaye</span>
              <div className="text-xs text-gray-500 -mt-0.5">Financial Services</div>
            </div>
          )}
        </div>
        
        {/* Collapse/Expand Toggle Button */}
        {!collapsed && (
          <button 
            onClick={onToggleCollapse}
            className="flex items-center justify-center rounded-full w-6 h-6 transition-all duration-200 shadow-sm bg-gray-100 text-gray-600 hover:bg-gray-200"
            title="Collapse Sidebar"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        
        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="absolute top-4 -right-3 z-20">
            <button 
              onClick={onToggleCollapse}
              className="flex items-center justify-center rounded-full w-6 h-6 transition-all duration-200 shadow-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              title="Expand Sidebar"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <div className="pt-4 overflow-y-auto h-[calc(100vh-4rem)]">
        {sidebarLinks.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            {!collapsed && (
              <p className="px-6 text-xs text-gray-400 uppercase font-medium mb-2">
                {group.group}
              </p>
            )}

            {group.links.map((link, linkIndex) => (
              <div key={linkIndex}>
                {link.href === "/logout" ? (
                  <button
                    type="button"
                    className={cn(
                      "sidebar-link w-full text-left",
                      collapsed && "justify-center px-0",
                      link.className,
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      // Clear authentication data
                      localStorage.removeItem("isLoggedIn");
                      localStorage.removeItem("userData");

                      // Force page reload to ensure everything is reset
                      window.location.href = "/login";
                    }}
                  >
                    <link.icon
                      className={cn("text-lg", collapsed ? "mr-0" : "mr-3")}
                    />
                    {!collapsed && <span>{link.label}</span>}
                  </button>
                ) : (
                  <Link 
                    href={link.href}
                    className={cn(
                      "sidebar-link",
                      isLinkActive(link.href) && "active",
                      collapsed && "justify-center px-0",
                      link.className,
                    )}
                  >
                    <link.icon
                      className={cn("text-lg", collapsed ? "mr-0" : "mr-3")}
                    />
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
