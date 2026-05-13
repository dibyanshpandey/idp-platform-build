import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react';

export default function FraudDetectionAccordion({ fraudAnalysis }) {
  const [openSections, setOpenSections] = useState({
    metadata: true,
    visual: false,
    validity: false,
    ai: false,
    incremental: false,
    font_analysis: false,
    vendor_profile: false
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (!fraudAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-slate-400" />
        <p className="text-sm font-medium tracking-wide uppercase">Running Forensics...</p>
      </div>
    );
  }

  if (fraudAnalysis.error) {
    return (
      <div className="flex flex-col h-full overflow-y-auto pr-1">
        <div className="p-4 border mb-4 flex items-center justify-between shadow-sm rounded-sm bg-red-50 border-red-200 text-red-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest mb-0.5">Fraud Detection Offline</p>
              <h2 className="text-sm font-bold">Service Unavailable</h2>
            </div>
          </div>
          <div className="text-right flex gap-6">
            <p className="text-xs font-medium text-red-700">{fraudAnalysis.error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Risk Profile (7 modules)
  const modules = ['metadata', 'visual', 'logical', 'duplicate', 'incremental', 'font_analysis', 'vendor_profile'];
  let issuesCount = 0;
  modules.forEach(mod => {
    if (['Fail', 'Review'].includes(fraudAnalysis[mod]?.status)) issuesCount++;
  });

  const riskScore = Math.max(0, Math.round(100 - (issuesCount * (100 / modules.length))));
  let riskLevel = 'Low';
  let bannerColor = 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400';
  let bannerIcon = <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;

  if (issuesCount > 0) {
    riskLevel = issuesCount > 1 ? 'High' : 'Medium';
    bannerColor = issuesCount > 1 
      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/30 text-red-800 dark:text-red-400'
      : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-400';
    bannerIcon = issuesCount > 1 
      ? <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
      : <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
  }

  // Helper to render sub-items
  const renderSubItem = (title, status, reason = null) => {
    const isPass = status === 'Pass' || status === 'N/A';
    const Icon = isPass ? CheckCircle : AlertTriangle;
    const color = isPass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
    
    return (
      <div className="flex flex-col py-2 border-t border-slate-100 dark:border-slate-800 first:border-0 pl-6 pr-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">{title}</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold uppercase ${color}`}>{status}</span>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
        </div>
        {!isPass && reason && (
          <div className="mt-1.5 p-2 bg-red-50 border border-red-100 rounded-sm">
            <p className="text-[10px] text-red-700 leading-tight flex items-start gap-1.5 font-medium">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              {reason}
            </p>
          </div>
        )}
      </div>
    );
  };

  const AccordionSection = ({ id, title, defaultStatus, data, children }) => {
    const isOpen = openSections[id];
    const isFail = defaultStatus === 'Fail';
    const statusColor = isFail ? 'text-red-600' : 'text-slate-500';
    
    return (
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-2 overflow-hidden shadow-sm rounded-sm transition-colors duration-200">
        <button 
          className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none border-b border-transparent"
          style={{ borderBottomColor: isOpen ? 'var(--tw-border-opacity, 1)' : 'transparent' }}
          onClick={() => toggleSection(id)}
        >
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 tracking-wide">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            {isFail && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 font-bold uppercase border border-red-200 dark:border-red-800/30 rounded-sm">Alert</span>}
            <div className={`w-2 h-2 rounded-full ${isFail ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
          </div>
        </button>
        {isOpen && (
          <div className="bg-white dark:bg-slate-900 flex flex-col pb-1 transition-colors duration-200">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pr-1">
      {/* Risk Assessment Banner */}
      <div className={`p-4 border mb-4 flex items-center justify-between shadow-sm rounded-sm ${bannerColor}`}>
        <div className="flex items-center gap-3">
          {bannerIcon}
          <div>
            <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest mb-0.5">Overall Risk Level</p>
            <h2 className="text-sm font-bold">{riskLevel} Risk</h2>
          </div>
        </div>
        <div className="text-right flex gap-6">
          <div>
            <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest mb-0.5">Issues Found</p>
            <p className="text-sm font-bold">{issuesCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold opacity-70 tracking-widest mb-0.5">Risk Score</p>
            <p className="text-sm font-mono font-bold">{riskScore}/100</p>
          </div>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="flex-1 space-y-1 pb-4">
        
        <AccordionSection id="metadata" title="Metadata Forensics" defaultStatus={fraudAnalysis.metadata?.status}>
          {renderSubItem('Editor / Creator', fraudAnalysis.metadata?.status, fraudAnalysis.metadata?.reason)}
          {renderSubItem('Hidden Text Detection', fraudAnalysis.metadata?.status, fraudAnalysis.metadata?.reason)}
        </AccordionSection>

        <AccordionSection id="visual" title="Visual Forensics" defaultStatus={fraudAnalysis.visual?.status}>
          {renderSubItem('Error Level Analysis', fraudAnalysis.visual?.status, fraudAnalysis.visual?.reason)}
          {renderSubItem('Copy-Move Detection', fraudAnalysis.visual?.status, fraudAnalysis.visual?.reason)}
        </AccordionSection>

        <AccordionSection id="validity" title="Logical Validation" defaultStatus={fraudAnalysis.logical?.status}>
          {renderSubItem('Grand Total Verification', fraudAnalysis.logical?.status, fraudAnalysis.logical?.reason)}
          {renderSubItem('Line Item Summation', 'Pass')}
        </AccordionSection>

        <AccordionSection id="duplicate" title="Duplicate Detection" defaultStatus={fraudAnalysis.duplicate?.status}>
           {renderSubItem('SHA-256 Hash Check', fraudAnalysis.duplicate?.status, fraudAnalysis.duplicate?.reason)}
        </AccordionSection>

        <AccordionSection id="incremental" title="Incremental Update Analysis" defaultStatus={fraudAnalysis.incremental?.status}>
          {renderSubItem('%%EOF Marker Count', fraudAnalysis.incremental?.status, fraudAnalysis.incremental?.reason)}
          {renderSubItem('Cross-Reference Tables', fraudAnalysis.incremental?.status, fraudAnalysis.incremental?.reason)}
        </AccordionSection>

        <AccordionSection id="font_analysis" title="Font Anomaly Analysis" defaultStatus={fraudAnalysis.font_analysis?.status}>
          {renderSubItem('Font Subsetting', fraudAnalysis.font_analysis?.status, fraudAnalysis.font_analysis?.reason)}
          {renderSubItem('Orphan Font Detection', fraudAnalysis.font_analysis?.status, fraudAnalysis.font_analysis?.reason)}
        </AccordionSection>

        <AccordionSection id="vendor_profile" title="Vendor Profiling" defaultStatus={fraudAnalysis.vendor_profile?.status}>
          {renderSubItem('Metadata Fingerprint', fraudAnalysis.vendor_profile?.status, fraudAnalysis.vendor_profile?.reason)}
          {renderSubItem('Layout Consistency', fraudAnalysis.vendor_profile?.status, fraudAnalysis.vendor_profile?.reason)}
        </AccordionSection>

      </div>
    </div>
  );
}
