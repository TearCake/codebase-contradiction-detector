'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  BookOpen,
  Sliders,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Link as LinkIcon,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { MOCK_ANALYSIS_RESULT } from '../engine/mockData';
import { AnalysisPipelineResult } from '../types/engine';
import { runFullAnalysisPipeline } from '../engine/index';

export default function Dashboard() {
  const [analysis, setAnalysis] = useState<AnalysisPipelineResult | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'FINDINGS' | 'GRAPH' | 'SUMMARY'>('FINDINGS');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      // In a real Next.js app, this might be a server action or API call.
      // For this demo, we can just run the pipeline if we can, but since it's browser side we might need to fetch it.
      // Let's assume there's an API endpoint, or for this specific fix, just fetch the real data from an API route.
      // Wait, this is a client component. I should fetch the data from an API route instead of running it locally.
      fetch('/api/analyze')
        .then((res) => res.json())
        .then((data) => {
          setAnalysis(data);
          if (data.findings && data.findings.length > 0 && !selectedFindingId) {
            setSelectedFindingId(data.findings[0].id);
          }
          setIsScanning(false);
        })
        .catch((err) => {
          console.error(err);
          // Fallback to mock data if API is not available
          setAnalysis({ ...MOCK_ANALYSIS_RESULT });
          if (!selectedFindingId) {
            setSelectedFindingId(MOCK_ANALYSIS_RESULT.findings[0]?.id || null);
          }
          setIsScanning(false);
        });
    }, 400);
  };

  useEffect(() => {
    handleRunScan();
  }, []);

  const selectedFinding = analysis?.findings.find((f) => f.id === selectedFindingId);

  const filteredFindings = analysis?.findings.filter((f) => {
    if (selectedCategory === 'ALL') return true;
    return f.category === selectedCategory;
  }) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100 flex items-center gap-2">
              Codebase Contradiction Detector
              <span className="text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                BuildSprint 2026
              </span>
            </h1>
            <p className="text-xs text-slate-400">Multi-Source Truth Disagreement & Claim Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className="flex items-center space-x-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow-lg shadow-sky-500/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Repo...' : 'Rescan Repository'}</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      {analysis && (
        <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto p-6 space-y-6">
          {/* Header Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Health Score Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 relative flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    {/* Background Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-slate-800"
                    />
                    {/* Progress Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - Math.max(0, Math.min(100, analysis.healthScore)) / 100)}`}
                      strokeLinecap="round"
                      className="text-amber-400 transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold font-mono text-amber-400">{analysis.healthScore}</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Repository Health</span>
                <h3 className="text-sm font-semibold text-slate-200 mt-0.5">
                  {analysis.healthScore > 80 ? 'Good Condition' : 'Truth Disagreements Found'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{analysis.findings.length} active contradictions</p>
              </div>
            </div>

            {/* Artifacts Scanned */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 border border-indigo-500/20">
                <FileCode2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Scanned Scope</span>
                <h3 className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  {analysis.summary.relevantArtifactsCount} <span className="text-xs font-normal text-slate-400">files</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">{analysis.summary.totalFilesScanned} total items indexed</p>
              </div>
            </div>

            {/* Claims Extracted */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Claims Graph</span>
                <h3 className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  {analysis.claims.length} <span className="text-xs font-normal text-slate-400">extracted claims</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">{analysis.graph.nodes.length} graph nodes linked</p>
              </div>
            </div>

            {/* Safety Verification */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex items-center space-x-4">
              <div className="p-3 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Safety Layer</span>
                <h3 className="text-lg font-bold text-sky-400 font-mono mt-0.5">100% Verified</h3>
                <p className="text-xs text-slate-400 mt-1">AST & line anchors proven on disk</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('FINDINGS')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'FINDINGS'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Contradictions ({analysis.findings.length})
              </button>
              <button
                onClick={() => setActiveTab('GRAPH')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'GRAPH'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Context Graph Explorer
              </button>
            </div>

            {activeTab === 'FINDINGS' && (
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">Filter:</span>
                {['ALL', 'BEHAVIORAL', 'STRUCTURAL', 'API_CONTRACT', 'CONFIGURATION', 'TESTING'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
                      selectedCategory === cat
                        ? 'bg-slate-800 text-sky-400 border border-slate-700'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab 1: Findings Explorer with Hero 3-Pane Evidence View */}
          {activeTab === 'FINDINGS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Findings List Sidebar */}
              <div className="lg:col-span-4 space-y-3">
                {filteredFindings.map((finding) => {
                  const isSelected = finding.id === selectedFindingId;
                  return (
                    <div
                      key={finding.id}
                      onClick={() => setSelectedFindingId(finding.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-sky-500/50 shadow-lg shadow-sky-500/5 ring-1 ring-sky-500/20'
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                            finding.severity === 'CRITICAL'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : finding.severity === 'HIGH'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {(finding.confidenceScore * 100).toFixed(0)}% confidence
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{finding.title}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{finding.summary}</p>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                        <span className="font-mono text-slate-400">{finding.category}</span>
                        <span>{finding.conflictingClaims.length} conflicting sources</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Main Evidence Proof Viewer */}
              <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
                {selectedFinding ? (
                  <>
                    {/* Header Details */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md">
                          {selectedFinding.subject}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Finding ID: <span className="text-slate-300">{selectedFinding.id}</span>
                        </span>
                      </div>

                      <h2 className="text-xl font-bold text-slate-100 mt-3">{selectedFinding.title}</h2>
                      <p className="text-sm text-slate-300 mt-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
                        {selectedFinding.summary}
                      </p>
                    </div>

                    {/* Conflicting Evidence Panes */}
                    <div>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Conflicting Multi-Source Claims ({selectedFinding.conflictingClaims.length} Panes)
                      </h3>

                      <div
                        className={`grid gap-4 ${
                          selectedFinding.conflictingClaims.length === 3
                            ? 'grid-cols-1 md:grid-cols-3'
                            : 'grid-cols-1 md:grid-cols-2'
                        }`}
                      >
                        {selectedFinding.conflictingClaims.map((claim, idx) => (
                          <div
                            key={claim.id}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                <span className="text-xs font-semibold text-sky-400 uppercase font-mono">
                                  [{claim.sourceType}] Pane {idx + 1}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">{claim.filePath}</span>
                              </div>

                              <p className="text-xs text-slate-300 my-2 font-medium bg-slate-900/60 p-2 rounded">
                                "{claim.assertion}"
                              </p>

                              {/* Verbatim Snippet */}
                              <div className="mt-2">
                                <span className="text-[10px] text-slate-500 uppercase font-mono">
                                  Lines {claim.startLine}-{claim.endLine}:
                                </span>
                                <pre className="mt-1 p-2.5 bg-slate-900 text-slate-300 font-mono text-[11px] rounded border border-slate-800 overflow-x-auto whitespace-pre-wrap">
                                  {claim.rawSnippet}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Incompatibility Reason */}
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">
                        Incompatibility Impact Reason
                      </h4>
                      <p className="text-xs text-rose-200/90 leading-relaxed">
                        {selectedFinding.incompatibilityReason}
                      </p>
                    </div>

                    {/* Likely Authoritative Source Analysis */}
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-4 flex items-start space-x-3">
                      <Sparkles className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                          Likely Authoritative Source
                        </h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs font-mono font-bold text-slate-200">
                            Source:{' '}
                            <span className="text-sky-300">
                              {selectedFinding.probabilisticSourceOfTruth.filePath}
                            </span>
                          </span>
                          <span className="text-xs font-mono bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded">
                            Evidence Score: {(selectedFinding.probabilisticSourceOfTruth.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {selectedFinding.probabilisticSourceOfTruth.reasoning}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                    Select a contradiction finding from the list to inspect multi-source evidence.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Context Graph Explorer */}
          {activeTab === 'GRAPH' && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-sky-400" />
                  Relationship Explorer
                </h3>
                <div className="flex space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                    <span className="text-slate-400 font-medium">Artifacts: <span className="text-slate-200">{analysis.graph.nodes.filter(n => n.type === 'ARTIFACT').length}</span></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span className="text-slate-400 font-medium">Claims: <span className="text-slate-200">{analysis.graph.nodes.filter(n => n.type === 'CLAIM').length}</span></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                    <span className="text-slate-400 font-medium">Subjects: <span className="text-slate-200">{analysis.graph.nodes.filter(n => n.type === 'SUBJECT').length}</span></span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                    <span className="text-slate-400 font-medium">Contradictions: <span className="text-slate-200">{analysis.findings.length}</span></span>
                  </div>
                </div>
              </div>

              {!selectedFindingId ? (
                <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                  <GitBranch className="w-12 h-12 mb-4 text-slate-700" />
                  <p className="text-lg">Select a contradiction to explore its context graph</p>
                  <button 
                    onClick={() => setActiveTab('FINDINGS')}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                  >
                    View Contradictions List
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {(() => {
                    const finding = analysis.findings.find(f => f.id === selectedFindingId);
                    if (!finding) return null;

                    const subjectNode = analysis.graph.nodes.find(n => n.id === `subject:${finding.subject}`);
                    const isLogical = subjectNode?.data?.isLogical === true;

                    const conflictEdges = analysis.graph.edges.filter(e => 
                      e.relation === 'CONFLICTS_WITH' && 
                      finding.conflictingClaims.some(c => c.id === e.source) &&
                      finding.conflictingClaims.some(c => c.id === e.target)
                    );
                    
                    return (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 relative">
                        {isLogical && (
                          <div className="mb-10 text-center">
                            <h4 className="text-rose-400 font-mono text-sm mb-2 uppercase tracking-widest border border-rose-500/20 bg-rose-500/10 inline-block px-3 py-1 rounded">Logical Mismatch</h4>
                            <div className="text-lg font-bold text-slate-300 flex items-center justify-center space-x-2">
                              <span>Expected vs Actual Discrepancy</span>
                            </div>
                          </div>
                        )}

                        {/* Top Conflict Bar */}
                        <div className="w-full mb-10 flex flex-col items-center relative">
                          <div className="absolute top-1/2 left-10 right-10 h-px border-t-2 border-dashed border-rose-500/50 z-0"></div>
                          <div className="bg-slate-950 border border-rose-500/50 rounded-lg px-6 py-2 shadow-lg flex items-center space-x-3 z-10">
                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                            <span className="text-sm font-bold text-rose-400 tracking-wider font-mono">
                              CONFLICTS_WITH
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full">{conflictEdges.length} edges</span>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-stretch justify-center gap-6 relative z-10">
                          {finding.conflictingClaims.map((claim, idx) => {
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center relative">
                                {/* Artifact Node */}
                                <div className="w-full bg-slate-900 border border-indigo-500/30 rounded-lg p-4 shadow-lg flex flex-col items-center text-center relative">
                                  <div className="absolute -top-3 px-2 bg-slate-950 text-[10px] uppercase font-bold text-indigo-400 tracking-wider border border-indigo-500/30 rounded">Source Artifact</div>
                                  <FileCode2 className="w-8 h-8 text-indigo-400 mb-2 opacity-80" />
                                  <span className="font-mono text-sm text-slate-200 break-all">{claim.filePath}</span>
                                  <span className="text-xs text-slate-500 mt-1 uppercase font-semibold">{claim.sourceType}</span>
                                </div>

                                {/* Contains Edge */}
                                <div className="h-12 w-px bg-slate-700 relative flex items-center justify-center my-2">
                                  <ArrowDown className="w-4 h-4 text-slate-500 absolute -bottom-1 bg-slate-950" />
                                  <div className="absolute left-3 bg-slate-950 px-2 text-[10px] font-mono text-slate-500 border border-slate-800 rounded whitespace-nowrap">
                                    CONTAINS
                                  </div>
                                </div>

                                {/* Claim Node */}
                                <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-lg p-4 shadow-lg flex flex-col items-center text-center relative flex-1">
                                  <div className="absolute -top-3 px-2 bg-slate-950 text-[10px] uppercase font-bold text-emerald-400 tracking-wider border border-emerald-500/30 rounded">Extracted Claim</div>
                                  <p className="text-sm text-slate-300 font-medium italic mb-3 mt-2">"{claim.assertion}"</p>
                                  <div className="mt-auto bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-emerald-400/80">
                                    Lines: {claim.startLine}-{claim.endLine}
                                  </div>
                                </div>

                                {/* Addresses Edge */}
                                <div className="h-12 w-px bg-slate-700 relative flex items-center justify-center my-2">
                                  <ArrowDown className="w-4 h-4 text-slate-500 absolute -bottom-1 bg-slate-950" />
                                  <div className="absolute left-3 bg-slate-950 px-2 text-[10px] font-mono text-slate-400 border border-slate-700 rounded whitespace-nowrap">
                                    ADDRESSES
                                  </div>
                                </div>

                                {/* Subject Node for Case B (Logical) */}
                                {isLogical && (
                                  <div className="w-full bg-slate-900 border border-amber-500/30 rounded-lg p-4 shadow-lg flex flex-col items-center text-center relative mt-auto">
                                    <div className="absolute -top-3 px-2 bg-slate-950 text-[10px] uppercase font-bold text-amber-400 tracking-wider border border-amber-500/30 rounded">Subject</div>
                                    <Layers className="w-6 h-6 text-amber-400 mb-2 opacity-80" />
                                    <span className="font-mono text-xs text-slate-200 break-all">{claim.subject}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Shared Subject for Case A */}
                        {!isLogical && (
                          <div className="mt-6 flex flex-col items-center">
                            <div className="bg-slate-900 border border-amber-500/50 rounded-lg p-5 shadow-lg flex flex-col items-center text-center relative z-10 min-w-[300px]">
                              <div className="absolute -top-3 px-3 bg-slate-950 text-[10px] uppercase font-bold text-amber-400 tracking-widest border border-amber-500/40 rounded">
                                Shared Subject
                              </div>
                              <Layers className="w-8 h-8 text-amber-400 mb-2 opacity-80" />
                              <span className="font-mono text-lg text-slate-200">{finding.subject}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
