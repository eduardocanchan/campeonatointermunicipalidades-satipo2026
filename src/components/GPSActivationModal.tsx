import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  LocateFixed,
  Play,
  Square,
  HelpCircle,
} from 'lucide-react';
import { UserLocation } from '../types';

interface GPSActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  gpsStatus: 'granted' | 'prompt' | 'denied' | 'requesting' | 'unavailable';
  userLocation: UserLocation | null;
  onRequestGPS: () => void;
  onUseDefaultLocation: () => void;
  onCenterMapToLocation: () => void;
  isGpsTracking?: boolean;
  onToggleGpsTracking?: (active: boolean) => void;
  isSimulatingGps?: boolean;
  onSimulateGpsMovement?: () => void;
}

export const GPSActivationModal: React.FC<GPSActivationModalProps> = ({
  isOpen,
  onClose,
  gpsStatus,
  userLocation,
  onRequestGPS,
  onUseDefaultLocation,
  onCenterMapToLocation,
  isGpsTracking = true,
  onToggleGpsTracking,
  isSimulatingGps = false,
  onSimulateGpsMovement,
}) => {
  const [lastAttemptMessage, setLastAttemptMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  if (!isOpen) return null;

  const isGranted = gpsStatus === 'granted' && !userLocation?.isSimulated;
  const isRequesting = gpsStatus === 'requesting';

  const handleRequestClick = () => {
    setLastAttemptMessage(null);
    onRequestGPS();
  };

  const handleCenterAndClose = () => {
    if (onToggleGpsTracking) onToggleGpsTracking(true);
    onCenterMapToLocation();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gps-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-emerald-950 border-b border-sky-500/20 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shadow-md">
              <Navigation className="w-5 h-5 fill-sky-400/20 animate-pulse" />
            </div>
            <div>
              <h3 id="gps-modal-title" className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Geolocalización y GPS en Vivo</span>
              </h3>
              <p className="text-xs text-slate-400">
                Satipo 2026 • Seguimiento satelital en tiempo real
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Status Alert Banner */}
          {isGranted ? (
            <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-start gap-3 text-emerald-200 shadow-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-white text-sm">¡GPS Activo y Conectado!</p>
                <p className="text-emerald-300">
                  Tu dispositivo está transmitiendo coordenadas satelitales en vivo.
                  {userLocation?.accuracy && (
                    <span className="font-semibold block mt-0.5">
                      Precisión satelital: ±{Math.round(userLocation.accuracy)} metros
                    </span>
                  )}
                  {userLocation?.speed && userLocation.speed > 0.5 && (
                    <span className="font-semibold block mt-0.5 text-sky-300">
                      Velocidad: {(userLocation.speed * 3.6).toFixed(1)} km/h
                    </span>
                  )}
                </p>
              </div>
            </div>
          ) : isRequesting ? (
            <div className="p-4 rounded-2xl bg-sky-950/70 border border-sky-500/40 flex items-center gap-3 text-sky-200 shadow-md animate-pulse">
              <RefreshCw className="w-5 h-5 text-sky-400 animate-spin flex-shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-white">Solicitando señal GPS al dispositivo...</p>
                <p className="text-sky-300 text-[11px]">
                  Toca &quot;Permitir&quot; si el navegador te solicita permiso de ubicación.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-start gap-3 text-amber-200 shadow-md">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-extrabold text-white text-sm">Seguimiento por GPS en Tiempo Real</p>
                <p className="text-amber-300 leading-relaxed">
                  Permite el acceso a la ubicación para ver tu posición en vivo sobre las calles de Satipo, con cono de visión según la brújula y seguimiento automático de cámara mientras te desplazas hacia las sedes.
                </p>
              </div>
            </div>
          )}

          {/* Quick Real-Time Settings */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Opciones de Navegación</span>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>¿Cómo activar GPS?</span>
              </button>
            </h4>

            {/* How to activate help */}
            {showHelp && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 space-y-2 animate-in fade-in">
                <p className="font-bold text-white">📱 En Celulares (Android / iOS):</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                  <li>Enciende el icono de <strong>Ubicación / GPS</strong> en el panel superior del celular.</li>
                  <li>En Chrome o Safari, toca el candado o icono &quot;aA&quot; en la barra de direcciones y selecciona <strong>Permitir Ubicación</strong>.</li>
                  <li>Si estás bajo techo, acércate a una ventana o calle abierta para conectar satélites.</li>
                </ul>
              </div>
            )}

            {/* Simulation Testing Shortcut */}
            {onSimulateGpsMovement && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white">Modo Simulación de Movimiento</p>
                  <p className="text-[11px] text-slate-400">
                    Prueba el desplazamiento y seguimiento automático por las calles de Satipo.
                  </p>
                </div>
                <button
                  onClick={onSimulateGpsMovement}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                    isSimulatingGps
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isSimulatingGps ? <Square className="w-3.5 h-3.5 fill-slate-950" /> : <Play className="w-3.5 h-3.5 fill-slate-200" />}
                  <span>{isSimulatingGps ? 'Detener' : 'Simular'}</span>
                </button>
              </div>
            )}
          </div>

          {lastAttemptMessage && (
            <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{lastAttemptMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row gap-2.5">
          {isGranted ? (
            <button
              onClick={handleCenterAndClose}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950 cursor-pointer"
            >
              <LocateFixed className="w-4 h-4" />
              <span>Centrar y Seguir en Vivo</span>
            </button>
          ) : (
            <button
              onClick={handleRequestClick}
              disabled={isRequesting}
              className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 active:scale-98 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-sky-950 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRequesting ? 'animate-spin' : ''}`} />
              <span>{isRequesting ? 'Conectando GPS...' : 'Activar GPS en Tiempo Real'}</span>
            </button>
          )}

          <button
            onClick={() => {
              onUseDefaultLocation();
              onClose();
            }}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-700"
            title="Usar la Plaza Principal de Satipo como referencia"
          >
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Centro de Satipo</span>
          </button>
        </div>
      </div>
    </div>
  );
};

