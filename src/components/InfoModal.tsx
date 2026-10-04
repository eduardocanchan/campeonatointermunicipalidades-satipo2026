import React from 'react';
import {
  X,
  MapPin,
  Calendar,
  Trophy,
  Phone,
  Sparkles,
  Lock,
  LogOut,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  Edit,
  ShieldCheck,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { GuideInfo } from '../types';
import { DEFAULT_GUIDE_INFO } from '../data/defaultData';

interface InfoModalProps {
  guideInfo?: GuideInfo;
  onClose?: () => void;
  isAdminMode?: boolean;
  onOpenAdminAuth?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenEditGuide?: () => void;
  onLogoutAdmin?: () => void;
  isEmbedded?: boolean;
}

const InfoModalComponent: React.FC<InfoModalProps> = ({
  guideInfo: rawGuideInfo,
  onClose,
  isAdminMode = false,
  onOpenAdminAuth,
  onOpenAdminPanel,
  onOpenEditGuide,
  onLogoutAdmin,
  isEmbedded = false,
}) => {
  const guideInfo = rawGuideInfo || DEFAULT_GUIDE_INFO;
  const content = (
    <div className="space-y-5 text-xs text-slate-200">
      {/* Admin Quick Action Button if Admin Mode is active */}
      {isAdminMode && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-amber-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold text-[11px]">Modo Administración Activo</span>
          </div>
          <button
            id="btn-quick-edit-guide"
            onClick={onOpenEditGuide || onOpenAdminPanel}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Modificar Esta Guía</span>
          </button>
        </div>
      )}

      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 p-4 sm:p-5 rounded-2xl border border-emerald-500/40 text-slate-200 space-y-2.5 shadow-lg">
        <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm sm:text-base">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{guideInfo.welcomeTitle || '¡Bienvenidos a Satipo!'}</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-normal">
          {guideInfo.welcomeDescription}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-teal-300 font-semibold border-t border-emerald-800/40">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>{guideInfo.eventDates || '18 y 19 de Septiembre de 2026'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{guideInfo.eventLocation || 'Satipo, Región Junín, Perú'}</span>
          </div>
        </div>
      </div>

      {/* Disciplines */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" /> Disciplinas Oficiales en Competencia
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {guideInfo.disciplines && guideInfo.disciplines.length > 0 ? (
            guideInfo.disciplines.map((disc, idx) => (
              <span
                key={idx}
                className="bg-slate-800/90 text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-medium shadow-sm hover:border-emerald-500/40 transition"
              >
                {disc}
              </span>
            ))
          ) : (
            <p className="text-slate-400 text-xs italic">No hay disciplinas registradas.</p>
          )}
        </div>
      </div>

      {/* Recommendations / Normas */}
      {guideInfo.recommendations && guideInfo.recommendations.length > 0 && (
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-2.5">
          <h4 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            Recomendaciones para las Delegaciones
          </h4>
          <ul className="space-y-1.5 text-slate-300 text-[11px]">
            {guideInfo.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">•</span>
                <span className="leading-snug">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Satipo Tourism & Emergency */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-slate-300">
        <h4 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          Teléfonos de Emergencia y Asistencia en Satipo
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
          {guideInfo.emergencyContacts && guideInfo.emergencyContacts.length > 0 ? (
            guideInfo.emergencyContacts.map((contact) => {
              const cleanPhone = String(contact.phone || '').replace(/[^0-9]/g, '');
              const displayPhone = contact.phone || 'S/N';
              return (
                <div
                  key={contact.id}
                  className="p-2 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <span className="font-semibold text-slate-200">{contact.name || 'Contacto'}:</span>
                  {cleanPhone ? (
                    <a
                      href={`tel:${cleanPhone}`}
                      className="text-emerald-400 font-bold hover:underline ml-1"
                    >
                      {displayPhone}
                    </a>
                  ) : (
                    <span className="text-slate-400 font-medium ml-1">{displayPhone}</span>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-slate-400 text-xs italic">No hay contactos registrados.</p>
          )}
        </div>
      </div>

      {/* Additional Notes */}
      {guideInfo.additionalNotes && (
        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-[11px] text-slate-400 leading-relaxed italic">
          ℹ️ {guideInfo.additionalNotes}
        </div>
      )}

      {/* Discreet Organizer Access Footer */}
      <div className="border-t border-slate-800/80 pt-4 mt-6">
        {isAdminMode ? (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-bold text-xs">Sesión de Administrador Activa</p>
                <p className="text-[10px] text-amber-400/80">Tienes acceso para editar sedes, fixture y la guía.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition"
                >
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Panel Admin</span>
                </button>
              )}
              {onLogoutAdmin && (
                <button
                  onClick={onLogoutAdmin}
                  className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center gap-1 border border-slate-700 transition"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800/60">
            <div className="flex items-center gap-2 text-slate-400">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px]">Acceso a Comisión Organizadora</span>
            </div>
            {onOpenAdminAuth && (
              <button
                id="btn-open-admin-login"
                onClick={onOpenAdminAuth}
                className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700 transition"
              >
                Ingresar PIN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="w-full max-w-3xl mx-auto px-2.5 sm:px-4 py-3 sm:py-4 pb-24 text-slate-100">
        <div className="bg-slate-900/90 backdrop-blur-md p-3.5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl overflow-hidden min-w-0">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-[11px] font-black uppercase text-teal-400 tracking-wider">
                Guía Informativa
              </span>
              <h2 className="text-lg font-black text-slate-100">
                {guideInfo.welcomeSubtitle || 'Campeonato Intermunicipalidades Satipo 2026'}
              </h2>
            </div>
            {isAdminMode && (
              <button
                onClick={onOpenEditGuide || onOpenAdminPanel}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Modificar Guía</span>
              </button>
            )}
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex justify-center items-end sm:items-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 rounded-t-3xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ★
            </div>
            <div>
              <h3 className="text-base font-black text-slate-100">
                {guideInfo.welcomeSubtitle || 'Campeonato Intermunicipalidades 2026'}
              </h3>
              <p className="text-xs text-slate-400">
                {guideInfo.eventLocation || 'Sede Provincial: Satipo, Región Junín, Perú'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {content}
        </div>
      </div>
    </div>
  );
};

export const InfoModal = React.memo(InfoModalComponent);
