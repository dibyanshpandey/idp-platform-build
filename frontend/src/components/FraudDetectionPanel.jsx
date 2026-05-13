import React from 'react';
import { ShieldCheck, ShieldAlert, FileCode, Fingerprint, Calculator, Copy, Loader2, AlertTriangle } from 'lucide-react';

export default function FraudDetectionPanel({ fraudAnalysis }) {
  
  if (!fraudAnalysis) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 p-4 flex flex-col items-center justify-center min-h-[140px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin mb-2" />
        <p className="text-xs text-zinc-400 font-semibold tracking-wider uppercase">Running Forensics...</p>
      </div>
    );
  }

  if (fraudAnalysis.error) {
    return (
      <div className="bg-red-950/20 border border-red-900/50 p-4 flex items-center justify-center min-h-[140px]">
        <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
        <p className="text-xs text-red-400 font-semibold">{fraudAnalysis.error}</p>
      </div>
    );
  }

  const renderBadge = (status) => {
    switch(status) {
      case 'Pass':
        return <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide">Pass</span>;
      case 'Fail':
        return <span className="bg-red-900 text-red-200 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide">Fail</span>;
      case 'Review':
      default:
        return <span className="bg-amber-900 text-amber-200 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide">Review</span>;
    }
  };

  const renderModule = (key, title, icon, data) => {
    if (!data) return null;
    const isFail = data.status === 'Fail';
    const isReview = data.status === 'Review';
    
    let borderColor = 'border-zinc-800 bg-zinc-950';
    if (isFail) borderColor = 'border-red-900/50 bg-red-950/20';
    if (isReview) borderColor = 'border-amber-900/50 bg-amber-950/10';

    let iconColor = 'text-zinc-500';
    if (isFail) iconColor = 'text-red-500';
    if (isReview) iconColor = 'text-amber-500';

    return (
      <div className={`p-3 border flex flex-col justify-between ${borderColor}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {React.cloneElement(icon, { className: `w-4 h-4 ${iconColor}` })}
            <span className="text-xs font-semibold text-zinc-300">{title}</span>
          </div>
          {renderBadge(data.status)}
        </div>
        <p className={`text-[10px] mt-1 ${isFail ? 'text-red-400 font-medium' : isReview ? 'text-amber-400 font-medium' : 'text-zinc-500'}`}>
          {data.reason}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        Fraud & Security Analysis
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {renderModule('metadata', 'Metadata Forensics', <FileCode />, fraudAnalysis.metadata)}
        {renderModule('visual', 'Visual Forensics', <Fingerprint />, fraudAnalysis.visual)}
        {renderModule('logical', 'Logical Validation', <Calculator />, fraudAnalysis.logical)}
        {renderModule('duplicate', 'Duplicate Detection', <Copy />, fraudAnalysis.duplicate)}
      </div>
    </div>
  );
}
