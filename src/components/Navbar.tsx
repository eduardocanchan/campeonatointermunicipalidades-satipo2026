import React, { useState } from 'react';
import { MapPin, Navigation2, QrCode, SlidersHorizontal } from 'lucide-react';
import { UserLocation } from '../types';

interface NavbarProps {
  userLocation: UserLocation | null;
  gpsStatus: 'granted' | 'prompt' | 'denied' | 'requesting' | 'unavailable';
  onLocateUser: () => void;
  onOpenQR: () => void;
  onOpenInfo?: () => void;
  activeTab: string;
  isAdminMode?: boolean;
  onOpenAdminAuth?: () => void;
  onOpenAdminPanel?: () => void;
}

const NavbarComponent: React.FC<NavbarProps> = ({
  userLocation,
  gpsStatus,
  onLocateUser,
  onOpenQR,
  onOpenInfo,
  isAdminMode = false,
  onOpenAdminAuth,
  onOpenAdminPanel,
}) => {
  const [clickCount, setClickCount] = useState(0);

  // Discreet triple-click on brand logo to open organizer PIN modal
  const handleBrandClick = () => {
    if (isAdminMode) {
      if (onOpenAdminPanel) onOpenAdminPanel();
      return;
    }
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 3) {
      setClickCount(0);
      if (onOpenAdminAuth) onOpenAdminAuth();
    } else {
      setTimeout(() => setClickCount(0), 1200);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-emerald-500/20 px-3.5 py-2.5 flex items-center justify-between text-white shadow-lg shadow-black/40 flex-shrink-0">
      {/* Brand & Event Title */}
      <div
        className="flex items-center space-x-2.5 cursor-pointer select-none"
        onClick={handleBrandClick}
        title={isAdminMode ? 'Panel de Administrador' : 'Campeonato Intermunicipalidades Satipo 2026'}
      >
        <div className={`h-10 sm:h-11 ${
          isAdminMode
            ? 'w-10 sm:w-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 ring-2 ring-amber-400/60 shadow-amber-950/60 p-2 flex items-center justify-center'
            : 'w-20 sm:w-24 rounded-xl bg-white ring-2 ring-emerald-400/60 shadow-md shadow-black/50 p-1 flex items-center justify-center'
        } flex-shrink-0 transition-transform active:scale-95 overflow-hidden`}>
          {isAdminMode ? (
            <SlidersHorizontal className="w-5 h-5 text-slate-950" />
          ) : (
            <img
              src="/marca_satipo_corazon.png"
              alt="Marca Satipo Corazón"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              isAdminMode
                ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
                : 'text-emerald-400 bg-emerald-950/80 border-emerald-500/30'
            }`}>
              {isAdminMode ? 'Comisión Admin' : 'Intermunicipalidades'}
            </span>
          </div>
          <h1 className="text-xs sm:text-sm font-extrabold text-slate-100 tracking-tight flex items-center gap-1">
            Sede Satipo <span className="text-[11px] sm:text-xs font-normal text-slate-400">• Selva Central</span>
          </h1>
        </div>
      </div>

      {/* Quick Action Badges */}
      <div className="flex items-center space-x-2">
        {/* GPS Live Status Indicator */}
        <button
          id="btn-locate-user-header"
          onClick={onLocateUser}
          title={
            gpsStatus === 'granted'
              ? 'Ubicación actual (Toca para centrar en tu posición)'
              : 'Activar GPS de ubicación actual'
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 active:scale-95 ${
            gpsStatus === 'granted'
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/50'
              : gpsStatus === 'requesting'
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 animate-pulse'
              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {gpsStatus === 'granted' ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">Ubicación actual</span>
              <Navigation2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20" />
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Ubicación actual</span>
            </>
          )}
        </button>

        {/* Admin Shortcut if logged in */}
        {isAdminMode && (
          <button
            id="btn-admin-header"
            onClick={onOpenAdminPanel}
            title="Abrir Panel de Administración de Sedes y Fixture"
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-sm active:scale-95 border border-amber-400"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        )}

        {/* QR Code Action Button */}
        <button
          id="btn-qr-header"
          onClick={onOpenQR}
          title="Ver Código QR Oficial para Participantes"
          className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-sm active:scale-95 border border-emerald-400/40"
        >
          <QrCode className="w-4.5 h-4.5" />
        </button>
      </div>
    </header>
  );
};

export const Navbar = React.memo(NavbarComponent);
