import React, { useRef, useState, useEffect } from 'react';
import { PenTool, Eraser, Upload, CheckCircle2, RotateCcw } from 'lucide-react';

interface SignatureCanvasProps {
  label: string;
  roleTitle: string;
  signerName: string;
  onSignerNameChange?: (name: string) => void;
  onSignatureCapture: (base64: string) => void;
  initialSignature?: string;
}

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  label,
  roleTitle,
  signerName,
  onSignerNameChange,
  onSignatureCapture,
  initialSignature
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(Boolean(initialSignature));
  const [signaturePreview, setSignaturePreview] = useState<string | null>(initialSignature || null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2563eb'; // Blue stroke
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const rawY = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    const x = rawX * (canvas.width / (rect.width || 1));
    const y = rawY * (canvas.height / (rect.height || 1));

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const rawY = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    const x = rawX * (canvas.width / (rect.width || 1));
    const y = rawY * (canvas.height / (rect.height || 1));

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSigned) {
      const dataUrl = canvas.toDataURL('image/png');
      setSignaturePreview(dataUrl);
      onSignatureCapture(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    setSignaturePreview(null);
    onSignatureCapture('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSignaturePreview(base64);
      setHasSigned(true);
      onSignatureCapture(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
      
      {/* Label and Signer Name Input */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-300 block">{label}</span>
          <span className="text-[11px] text-blue-400 font-mono">{roleTitle}</span>
        </div>
        {hasSigned && (
          <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Signed</span>
          </span>
        )}
      </div>

      <div>
        <label className="text-[11px] text-slate-400 block mb-1">Full Name of Signer</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => onSignerNameChange && onSignerNameChange(e.target.value)}
          placeholder="Enter authorized full name..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Signature Area */}
      <div className="relative bg-white rounded-lg border-2 border-dashed border-slate-300 overflow-hidden">
        {signaturePreview ? (
          <div className="relative p-2 flex flex-col items-center justify-center bg-white min-h-[120px]">
            <img src={signaturePreview} alt="Signature Preview" className="max-h-24 object-contain" />
            <span className="text-[10px] text-slate-500 mt-1">Digital Stamp Captured</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={320}
            height={110}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-28 cursor-crosshair bg-slate-50 touch-none"
          />
        )}

        {!hasSigned && !signaturePreview && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs">
            <PenTool className="w-4 h-4 mr-1.5 opacity-60" />
            <span>Draw signature here or upload image</span>
          </div>
        )}
      </div>

      {/* Signature Controls */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center space-x-1 text-slate-400 hover:text-rose-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear Canvas</span>
        </button>

        <label className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span>Upload File</span>
          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

    </div>
  );
};
