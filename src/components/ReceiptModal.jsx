import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, Calendar, User, Home, Users, FileText, DollarSign } from 'lucide-react';

export default function ReceiptModal({ transaction, isAdmin = false, onClose }) {
  const [zoomed, setZoomed] = useState(false);

  if (!transaction) return null;

  const isDeposit = transaction.type === 'deposit';
  if (isDeposit && !isAdmin) return null;
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(Number(transaction.amount) || 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          className={`px-4 sm:px-6 py-4 flex items-center justify-between text-white ${
            isDeposit
              ? 'bg-gradient-to-r from-emerald-800 to-emerald-600'
              : 'bg-gradient-to-r from-rose-800 to-rose-600'
          }`}
        >
          <div>
            <span className="inline-block text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 mb-1">
              {isDeposit ? 'Comprobante de Depósito' : 'Recibo / Factura de Gasto'}
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold leading-tight">
              {isDeposit ? transaction.name : transaction.paidTo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Transaction Summary Strip */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-3 text-slate-700">
            {isDeposit ? (
              <>
                <span className="inline-flex items-center gap-1 font-semibold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg">
                  <Home className="w-4 h-4 text-emerald-700" />
                  {transaction.camperNumber || 'Sin # Camper'}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold bg-blue-100 text-blue-900 px-2.5 py-1 rounded-lg">
                  <Users className="w-4 h-4 text-blue-700" />
                  {transaction.peopleCount || 1} {Number(transaction.peopleCount) === 1 ? 'Persona' : 'Personas'}
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                {transaction.description}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Calendar className="w-4 h-4" />
              {transaction.date || 'Sin fecha'}
            </span>
          </div>

          <div
            className={`text-lg sm:text-xl font-black px-3 py-1 rounded-xl ${
              isDeposit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {isDeposit ? '+' : '-'}
            {formattedAmount}
          </div>
        </div>

        {/* Image Viewer Container */}
        <div className="flex-1 overflow-auto bg-slate-900 p-3 sm:p-6 flex items-center justify-center min-h-[280px]">
          {transaction.receiptImage ? (
            <img
              src={transaction.receiptImage}
              alt="Imagen del recibo"
              onClick={() => setZoomed(!zoomed)}
              className={`rounded-xl shadow-lg transition-transform duration-200 cursor-zoom-in ${
                zoomed ? 'scale-125 cursor-zoom-out max-w-none' : 'max-h-[58vh] w-auto object-contain'
              }`}
            />
          ) : (
            <div className="text-center text-slate-400 py-12">
              <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p>Este registro no tiene imagen adjunta.</p>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="px-4 sm:px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {transaction.receiptImage && (
              <>
                <button
                  type="button"
                  onClick={() => setZoomed(!zoomed)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                  <span>{zoomed ? 'Reducir' : 'Ampliar'}</span>
                </button>
                <a
                  href={transaction.receiptImage}
                  download={`Recibo_${isDeposit ? transaction.camperNumber || 'Deposito' : transaction.paidTo || 'Gasto'}.jpg`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </a>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
