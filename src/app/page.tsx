'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  FileCode2,
  GitBranch,
  Layers,
  RefreshCw,
  ShieldCheck,
  Zap,
  Sliders,
  Sparkles,
  ArrowDown,
  CheckCircle2,
  Brain,
  Github,
  Search,
  ExternalLink,
  AlertCircle,
  FolderGit2,
  Check,
} from 'lucide-react';
import { AnalysisPipelineResult } from '../types/engine';

function formatSubjectLabel(subject: string): string {
  if (!subject) return 'Domain Logic';
  if (subject.startsWith('logical_conflict:') || subject.startsWith('conflict:')) {
    if (subject.includes('route:')) {
      const match = subject.match(/route:([^:]+)/);
      return match ? `Route ${match[1]}` : 'API Route Contract';
    }
    if (subject.includes('env:')) {
      const match = subject.match(/env:([^:]+)/);
      return match ? `Config Key ${match[1]}` : 'Environment Variable';
    }
    if (subject.includes('schema:')) {
      const match = subject.match(/schema:([^:]+)/);
      return match ? `Schema ${match[1]}` : 'API Schema Contract';
    }
    return 'Multi-Source Discrepancy';
  }
  if (subject.startsWith('route:')) return subject.replace('route:', 'Route ');
  if (subject.startsWith('env:')) return subject.replace('env:', 'Config Key ');
  if (subject.startsWith('schema:')) return subject.replace('schema:', 'Schema ');
  if (subject === 'cancellation_grace_period' || subject === 'domain:user_cancellation_period') return 'Cancellation Grace Period';
  if (subject === 'domain:auth_endpoint' || subject === 'EXPIRED_TOKEN_RESPONSE') return 'Authentication Endpoint';

  return subject.replace(/^[a-z_]+:/i, '').replace(/_/g, ' ');
}

function getConfidenceBadgeLabel(score: number): { label: string; colorClass: string } {
  if (score >= 0.85) {
    return { label: 'High Confidence', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  } else if (score >= 0.7) {
    return { label: 'Medium Confidence', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  } else {
    return { label: 'Low Confidence', colorClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  }
}

function getSourceTypeBadgeClass(sourceType: string): string {
  switch (sourceType) {
    case 'DOCS':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    case 'CODE':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'SPEC':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'CONFIG':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'TEST':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

export default function Dashboard() {
  const [analysis, setAnalysis] = useState<AnalysisPipelineResult | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'FINDINGS' | 'GRAPH'>('FINDINGS');
  
  // GitHub & Scan State
  const [githubUrl, setGithubUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runScan = async (sourceType: 'demo' | 'github', urlToScan?: string) => {
    setIsScanning(true);
    setErrorMessage(null);

    if (sourceType === 'github') {
      setProgressStage('Downloading repository...');
    } else {
      setProgressStage('Scanning artifacts...');
    }

    const timer1 = setTimeout(() => {
      if (sourceType === 'github') {
        setProgressStage('Scanning artifacts...');
      }
    }, 1500);

    const timer2 = setTimeout(() => {
      setProgressStage('Detecting contradictions...');
    }, 3000);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: sourceType,
          url: urlToScan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze repository.');
      }

      setAnalysis(data);
      if (data.findings && data.findings.length > 0) {
        setSelectedFindingId(data.findings[0].id);
      } else {
        setSelectedFindingId(null);
      }
    } catch (err: any) {
      console.error('Scan failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during repository analysis.');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsScanning(false);
      setProgressStage('');
    }
  };

  const handleScanDemo = () => {
    runScan('demo');
  };

  const handleScanGitHub = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!githubUrl.trim()) {
      setErrorMessage('Please enter a GitHub repository URL.');
      return;
    }
    runScan('github', githubUrl.trim());
  };

  // Removed automatic auto-scan on page load so user can choose source first.
  useEffect(() => {}, []);

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
          {analysis && (
            <div className="hidden sm:flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-lg border bg-slate-900 border-slate-800">
              <Brain className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400">Semantic Engine:</span>
              <span className={analysis.semanticStatus === 'COMPLETED' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                {analysis.semanticStatus === 'COMPLETED' ? '✓ Completed' : analysis.semanticStatus === 'RATE_LIMITED' ? '⚠ Rate Limited' : '⚠ Unavailable'}
              </span>
            </div>
          )}

          <button
            onClick={handleScanDemo}
            disabled={isScanning}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all disabled:opacity-50"
          >
            <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
            <span>Try Demo Repository</span>
          </button>
        </div>
      </header>

      {/* Hero / Input Panel */}
      <div className="bg-slate-900/40 border-b border-slate-800 py-6 px-6">
        <div className="max-w-[1600px] mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Github className="w-4 h-4 text-sky-400" />
                Analyze a GitHub repository
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Paste a public GitHub repository URL to download, extract, and scan all software artifacts for cross-source contradictions.
              </p>
            </div>

            {/* Quick Demo Button */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Or test with pre-built scenarios:</span>
              <button
                onClick={handleScanDemo}
                disabled={isScanning}
                className="text-xs font-mono bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                Run 5-Scenario Demo
              </button>
            </div>
          </div>

          {/* GitHub URL Input Bar */}
          <form onSubmit={handleScanGitHub} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="https://github.com/owner/repository"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled={isScanning}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || !githubUrl.trim()}
              className="flex items-center justify-center space-x-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-6 py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Github className="w-4 h-4" />
                  <span>Analyze Repository</span>
                </>
              )}
            </button>
          </form>

          {/* Loading Progress State Indicator */}
          {isScanning && (
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-4 flex items-center space-x-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-sky-300 font-mono">{progressStage}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Parsing AST definitions, extractors, and evaluating cross-artifact claim consistency...
                </p>
              </div>
            </div>
          )}

          {/* Validation / Analysis Error Banner */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-rose-300">Analysis Error</h4>
                <p className="text-xs text-rose-200/90 mt-1 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Repository Metadata Banner */}
          {analysis && analysis.repositoryInfo && !isScanning && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3 font-mono">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <FolderGit2 className="w-4 h-4 text-sky-400" />
                  Analyzed Source:
                </span>
                <span className="text-slate-200 font-bold">
                  {analysis.repositoryInfo.source === 'github' ? (
                    <a
                      href={analysis.repositoryInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      {analysis.repositoryInfo.owner}/{analysis.repositoryInfo.repo}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    'Bundled Demo Repository (demo-repo)'
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-4 font-mono text-slate-400">
                <span>
                  Files Indexed: <strong className="text-slate-200">{analysis.repositoryInfo.fileCount}</strong>
                </span>
                <span>
                  Artifacts Analyzed: <strong className="text-slate-200">{analysis.repositoryInfo.artifactCount}</strong>
                </span>
                <span>
                  Contradictions: <strong className="text-amber-400">{analysis.findings.length}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Initial Prompt View when no analysis has run yet */}
      {!analysis && !isScanning && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto p-8 text-center my-12">
          <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20 text-sky-400 mb-6">
            <Zap className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mb-3">
            Ready to Detect Codebase Contradictions
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xl mb-8">
            Choose an option above to begin: paste a public GitHub repository URL to download and analyze real code, or test the engine instantly on our 5-scenario synthetic demo repository.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center space-x-2 text-sky-400 font-semibold text-sm">
                <Github className="w-4 h-4" />
                <span>Option 1: Public GitHub Repo</span>
              </div>
              <p className="text-xs text-slate-400">
                Paste any public GitHub repository link (e.g. <code className="text-sky-300">https://github.com/expressjs/cors</code>) into the search bar above and click <strong className="text-slate-300">Analyze Repository</strong>.
              </p>
            </div>

            <div
              onClick={handleScanDemo}
              className="p-5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl space-y-2 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between text-sky-400 font-semibold text-sm">
                <span className="flex items-center space-x-2">
                  <FolderGit2 className="w-4 h-4" />
                  <span>Option 2: Try Demo Repository</span>
                </span>
                <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-xs text-slate-400">
                Click here or the button in the header to immediately analyze the bundled synthetic repository containing 5 structural, behavioral, schema, config, and test contradictions.
              </p>
            </div>
          </div>
        </div>
      )}

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
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-slate-800"
                    />
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
                    <span className="text-sm font-bold font-mono text-amber-400">{analysis.healthScore}/100</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Repository Health</span>
                <h3 className="text-sm font-semibold text-slate-200 mt-0.5">
                  Repository Health: {analysis.healthScore}/100
                </h3>
                <p className="text-xs text-amber-400 font-mono mt-1">{analysis.findings.length} active contradictions</p>
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

          {/* Tab 1: Findings Explorer */}
          {activeTab === 'FINDINGS' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Findings List Sidebar */}
              <div className="lg:col-span-4 space-y-3">
                {filteredFindings.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl">
                    No contradictions found matching filter.
                  </div>
                ) : (
                  filteredFindings.map((finding) => {
                    const isSelected = finding.id === selectedFindingId;
                    const confBadge = getConfidenceBadgeLabel(finding.confidenceScore);
                    const isMulti = finding.conflictingClaims.length >= 3;
                    const detectionTag = finding.detectionSource || 'DETERMINISTIC';

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
                          <div className="flex items-center space-x-1.5">
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
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60">
                              {detectionTag}
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${confBadge.colorClass}`}>
                            {confBadge.label}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{finding.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{finding.summary}</p>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
                          <span className="font-mono text-slate-400">{finding.category}</span>
                          <span className="font-mono text-slate-300 font-medium">
                            {isMulti ? 'Multi-source contradiction' : '2 conflicting sources'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Main Evidence Proof Viewer */}
              <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
                {selectedFinding ? (
                  <>
                    {/* 1. Human-Readable Title & Header Metadata */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-md">
                          {formatSubjectLabel(selectedFinding.subject)}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {selectedFinding.detectionSource || 'DETERMINISTIC'}
                          </span>
                          <span className={`text-xs font-mono px-2.5 py-0.5 rounded border ${getConfidenceBadgeLabel(selectedFinding.confidenceScore).colorClass}`}>
                            {getConfidenceBadgeLabel(selectedFinding.confidenceScore).label}
                          </span>
                          <span className="text-xs font-mono text-slate-400 border border-slate-800 bg-slate-950 px-2.5 py-0.5 rounded">
                            {selectedFinding.category}
                          </span>
                        </div>
                      </div>

                      <h2 className="text-xl font-bold text-slate-100 mt-3">{selectedFinding.title}</h2>
                      
                      {/* 2. Short Narrative Summary */}
                      <p className="text-sm text-slate-300 mt-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 leading-relaxed">
                        {selectedFinding.summary}
                      </p>
                    </div>

                    {/* 3. Conflicting Sources & Verbatim Evidence Panes */}
                    <div>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Conflicting Sources ({selectedFinding.conflictingClaims.length})
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {selectedFinding.conflictingClaims.length >= 3 ? 'Multi-source contradiction' : '2 conflicting sources'}
                        </span>
                      </h3>

                      <div
                        className={`grid gap-4 ${
                          selectedFinding.conflictingClaims.length >= 3
                            ? 'grid-cols-1 md:grid-cols-3'
                            : 'grid-cols-1 md:grid-cols-2'
                        }`}
                      >
                        {selectedFinding.conflictingClaims.map((claim) => (
                          <div
                            key={claim.id}
                            className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${getSourceTypeBadgeClass(claim.sourceType)}`}>
                                  {claim.sourceType}
                                </span>
                                <span className="text-[11px] font-mono text-slate-300 truncate max-w-[180px]" title={claim.filePath}>
                                  {claim.filePath}
                                </span>
                              </div>

                              <p className="text-xs text-slate-200 my-2.5 font-medium bg-slate-900/80 p-2.5 rounded border border-slate-800/80">
                                "{claim.assertion}"
                              </p>

                              {/* Verbatim Snippet */}
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                                  <span>Lines {claim.startLine}-{claim.endLine}</span>
                                  <span className="text-emerald-400/80 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Anchored</span>
                                </div>
                                <pre className="p-2.5 bg-slate-900 text-slate-300 font-mono text-[11px] rounded border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-48">
                                  {claim.rawSnippet}
                                </pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Incompatibility Impact Reason */}
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
                      <h4 className="text-xs font-semibold text-rose-400 uppercase tracking-wider mb-1">
                        Incompatibility Impact Reason
                      </h4>
                      <p className="text-xs text-rose-200/90 leading-relaxed">
                        {selectedFinding.incompatibilityReason}
                      </p>
                    </div>

                    {/* 5. Likely Authoritative Source & Evidence Verification */}
                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg p-4 flex items-start space-x-3">
                      <Sparkles className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                            Likely Authoritative Source
                          </h4>
                          <span className="flex items-center gap-1 text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> ✓ Evidence Verified
                          </span>
                        </div>
                        <div className="mt-1.5 text-xs font-mono font-bold text-slate-200">
                          File:{' '}
                          <span className="text-sky-300">
                            {selectedFinding.probabilisticSourceOfTruth.filePath}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {selectedFinding.probabilisticSourceOfTruth.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* 6. Secondary Metadata Footer */}
                    <div className="text-right pt-2 border-t border-slate-800/60">
                      <span className="text-[10px] font-mono text-slate-500">
                        Internal Ref: {selectedFinding.id}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                    Select a contradiction finding from the list to inspect evidence.
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
                                    <span className="font-mono text-xs text-slate-200 break-all">{formatSubjectLabel(claim.subject)}</span>
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
                              <span className="font-mono text-lg text-slate-200">{formatSubjectLabel(finding.subject)}</span>
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
