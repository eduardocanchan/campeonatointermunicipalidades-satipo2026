import React from 'react';
import { Map, MapPin, FileImage, Compass, SlidersHorizontal, Lock } from 'lucide-react';

export type TabType = 'mapa' | 'sedes' | 'plano' | 'guia' | 'admin';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  hasActiveRoute: boolean;
  venueCount: number;
  isAdminMode?: boolean;
}

const BottomNavComponent: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  hasActiveRoute,
  venueCount,
  isAdminMode = false,
}) => {
  // Tabs displayed according to role
  const tabs: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'mapa',
      label: 'Google Map',
      icon: Map,
      badge: hasActiveRoute ? 'Ruta' : undefined,
    },
    {
      id: 'sedes',
      label: 'Sedes',
      icon: MapPin,
      badge: venueCount,
    },
    {
      id: 'plano',
      label: 'Plano',
      icon: FileImage,
    },
    {
      id: 'guia',
      label: 'Guía e Info',
      icon: Compass,
    },
  ];

  // Only append Admin tab if logged in as organizer/admin
  if (isAdminMode) {
    tabs.push({
      id: 'admin',
      label: 'Admin',
      icon: SlidersHorizontal,
      badge: 'Panel',
      adminOnly: true,
    });
  }

  const gridColsClass = isAdminMode ? 'grid-cols-5' : 'grid-cols-4';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 px-2 py-1.5 pb-safe text-slate-400 select-none shadow-2xl shadow-black">
      <div className={`max-w-md mx-auto grid ${gridColsClass} gap-1`}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-150 active:scale-90 ${
                isActive
                  ? tab.adminOnly
                    ? 'text-amber-400 bg-amber-950/60 font-bold'
                    : 'text-emerald-400 bg-emerald-950/60 font-bold'
                  : 'hover:text-slate-200 hover:bg-slate-800/50 font-medium'
              }`}
            >
              {/* Active Indicator Top Pill */}
              {isActive && (
                <span
                  className={`absolute -top-1.5 w-6 h-1 rounded-full shadow-sm ${
                    tab.adminOnly
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 shadow-amber-400/50'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-400 shadow-emerald-400/50'
                  }`}
                />
              )}

              {/* Tab Icon with Badge */}
              <div className="relative mb-0.5">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1 -right-2 text-[9px] px-1 py-0.2 rounded-full font-black leading-tight border ${
                      tab.adminOnly
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : isActive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-700 text-slate-200 border-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              {/* Tab Label */}
              <span className="text-[10px] tracking-tight whitespace-nowrap leading-none mt-0.5">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const BottomNav = React.memo(BottomNavComponent);

