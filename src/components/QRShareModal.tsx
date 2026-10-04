import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Globe,
  Printer,
  Sparkles,
  Smartphone,
  ShieldAlert,
  Layers,
  Code
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface QRShareModalProps {
  onClose: () => void;
  isAdminMode?: boolean;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ onClose, isAdminMode = false }) => {
  const [appUrl, setAppUrl] = useState<string>(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      url.searchParams.delete('mode');
      return url.origin + url.pathname;
    } catch {
      return window.location.href || 'https://campeonato-satipo-2026.vercel.app';
    }
  });
  const [customUrl, setCustomUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'qr' | 'poster' | 'deploy'>('qr');
  const printRef = useRef<HTMLDivElement>(null);

  const effectiveUrl = isAdminMode && customUrl.trim() ? customUrl.trim() : appUrl;

  useEffect(() => {
    QRCode.toDataURL(effectiveUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: '#022c22', // Emerald dark
        light: '#ffffff',
      },
    })
      .then((url) => {
        setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating QR', err);
      });
  }, [effectiveUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(effectiveUrl);
    setCopied(true);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'QR_Campeonato_Satipo_2026_HD.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintBadge = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl text-slate-100 animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 rounded-t-3xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-slate-100">
                  {isAdminMode ? 'Código QR y Difusión Oficial' : 'Código QR del Campeonato'}
                </h3>
                {isAdminMode && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {isAdminMode
                  ? 'Gestión de difusión, afiches y despliegue'
                  : 'Escanea con tu celular para abrir la aplicación'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs (Only for Admin) */}
        {isAdminMode && (
          <div className="flex border-b border-slate-800 px-4 bg-slate-950/40">
            <button
              onClick={() => setActiveSubTab('qr')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'qr'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Generador QR HD
            </button>
            <button
              onClick={() => setActiveSubTab('poster')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'poster'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Afiche & Credencial
            </button>
            <button
              onClick={() => setActiveSubTab('deploy')}
              className={`py-3 px-3 text-xs font-bold border-b-2 transition ${
                activeSubTab === 'deploy'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Guía de Despliegue
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* PARTICIPANT VIEW: Focused QR display */}
          {!isAdminMode && (
            <div className="space-y-5">
              {/* QR Preview Box */}
              <div className="bg-gradient-to-b from-emerald-950/40 via-slate-900 to-slate-950 p-6 rounded-3xl border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-xl">
                <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-emerald-400 ring-4 ring-emerald-950 mb-4">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR Campeonato Satipo 2026"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                      Generando código QR...
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950 px-3.5 py-1 rounded-full border border-emerald-500/40">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Escanea con la cámara de tu celular</span>
                  </span>
                  <p className="text-xs text-slate-200 font-medium pt-1">
                    Abre la aplicación directamente en tu teléfono para ver mapas interactivos y el plano oficial sin necesidad de instalar nada.
                  </p>
                </div>
              </div>

              {/* Quick Actions for Participants */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '¡Enlace copiado!' : 'Copiar enlace de la App'}</span>
                </button>

                <button
                  onClick={handleDownloadQR}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar QR (Imagen)</span>
                </button>
              </div>
            </div>
          )}

          {/* ADMIN VIEW: Full Features */}
          {isAdminMode && activeSubTab === 'qr' && (
            <div className="space-y-5">
              {/* QR Preview Box */}
              <div className="bg-gradient-to-b from-emerald-950/50 to-slate-950 p-6 rounded-3xl border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-xl">
                <div className="bg-white p-4 rounded-2xl shadow-2xl border-4 border-emerald-400 ring-4 ring-emerald-950 mb-3">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Código QR Campeonato Satipo 2026"
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                      Generando QR...
                    </div>
                  )}
                </div>

                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-500/30 mb-1">
                  Escanea para abrir el Mapa y Plano
                </span>
                <p className="text-xs text-slate-300 max-w-sm">
                  Ideal para imprimir en gigantografías, afiches, banners de bienvenida y credenciales de atletas.
                </p>
              </div>

              {/* URL Customizer */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Enlace Vinculado al QR (Editable por el Administrador):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder={appUrl}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-300 focus:border-emerald-500 outline-none truncate font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Tip: Si subes la app a Vercel o Netlify, pega aquí tu dominio final (ej. <span className="text-slate-400 font-mono">https://satipo2026.vercel.app</span>).
                </p>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadQR}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Código QR (PNG HD)</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('poster')}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Ver Formato Afiche Imprimible</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: POSTER & CREDENTIAL TEMPLATE (ADMIN) */}
          {isAdminMode && activeSubTab === 'poster' && (
            <div className="space-y-4">
              <div
                ref={printRef}
                className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-6 rounded-3xl border-2 border-emerald-500/40 text-center space-y-4 shadow-2xl text-white relative overflow-hidden"
              >
                {/* Decorative Badge Background */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl"></div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-400/40 text-amber-300 text-xs font-black uppercase tracking-widest">
                  ★ CAMPEONATO INTERMUNICIPALIDADES 2026 ★
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100">
                    SEDE OFICIAL SATIPO
                  </h2>
                  <p className="text-sm font-bold text-emerald-400">
                    18 Y 19 DE SEPTIEMBRE DE 2026 • JUNÍN, PERÚ
                  </p>
                </div>

                {/* QR Display */}
                <div className="bg-white p-3 rounded-2xl w-fit mx-auto shadow-2xl border-4 border-amber-400">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR Campeonato Satipo 2026"
                      className="w-40 h-40 object-contain"
                    />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-amber-300 tracking-wide">
                    📲 ESCANEA CON LA CÁMARA DE TU CELULAR
                  </p>
                  <p className="text-[11px] text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Mapas interactivos de las sedes (Estadio, Coliseo, Complejo), rutas GPS en tiempo real y fixture completo de partidos por horarios.
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-800/60 flex items-center justify-around text-[10px] text-emerald-300 font-semibold">
                  <span>⚽ Fútbol 11</span>
                  <span>🏐 Vóley Mixto</span>
                  <span>👟 Futsal</span>
                  <span>🏃 Atletismo</span>
                  <span>🏊 Natación</span>
                </div>
              </div>

              <button
                onClick={handlePrintBadge}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Afiche / Credencial Directo</span>
              </button>
            </div>
          )}

          {/* TAB 3: DEPLOYMENT GUIDE (Prompt 2 fulfillment) */}
          {activeSubTab === 'deploy' && (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-sm">
                  <Globe className="w-4 h-4" />
                  <span>¿Cómo ponerlo en funcionamiento en 3 pasos?</span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-slate-100">Alojar la App Gratis</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Puedes desplegar este proyecto en <b>Vercel</b>, <b>Netlify</b> o <b>GitHub Pages</b> con solo conectar tu repositorio o subir los archivos compilados de <code className="text-emerald-300 bg-slate-900 px-1 py-0.5 rounded">dist/</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-slate-100">Obtén tu Enlace Seguro HTTPS</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Te entregará una URL del tipo <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">https://tu-evento-satipo.vercel.app</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-bold text-slate-100">Crear el Código QR Oficial</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Pega tu enlace en la pestaña <b>Generador QR HD</b> de esta misma aplicación y descarga la imagen en alta definición para imprimirla en afiches y credenciales de los 9 municipios.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* HTTPS Warning Note as requested */}
              <div className="bg-amber-950/40 border border-amber-500/40 p-3.5 rounded-2xl flex items-start gap-2 text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <b>Nota Importante de Seguridad:</b> Para que la geolocalización GPS por navegador funcione en smartphones de los asistentes, la URL donde alojes la web app debe contar obligatoriamente con protocolo seguro <b>HTTPS://</b> (habilitado automáticamente en Vercel, Netlify y GitHub Pages).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
