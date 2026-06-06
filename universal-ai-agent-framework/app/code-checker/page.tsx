"use client"

import { useState, useRef, useCallback } from "react"
import {
  Code2, Loader2, AlertTriangle, Info, Zap, ShieldAlert,
  ChevronDown, ChevronUp, Sparkles, Bot, Upload, X, FileCode2, FolderOpen, Files,
} from "lucide-react"
import { SemanticScoreRing } from "@/components/semantic-score-ring"
import { cn } from "@/lib/utils"
import type { CodeCheckResult } from "@/app/api/code-checker/route"
import { GROQ_MODELS, DEFAULT_JUDGE_MODEL, SPEED_CONFIG } from "@/lib/groq-models"

const LANGUAGES = [
  "auto", "typescript", "javascript", "python", "go", "rust", "java",
  "c", "c++", "c#", "php", "ruby", "swift", "kotlin", "sql", "bash",
]

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", go: "go", rs: "rust",
  java: "java", c: "c", cpp: "c++", cc: "c++", cxx: "c++", cs: "c#",
  php: "php", rb: "ruby", swift: "swift", kt: "kotlin", kts: "kotlin",
  sql: "sql", sh: "bash", bash: "bash", zsh: "bash",
}

const METRIC_LABELS: Record<string, string> = {
  readability: "Readability",
  maintainability: "Maintainability",
  security: "Security",
  complexity: "Complexity",
  bestPractices: "Best Practices",
}

const GRADE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  B: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  C: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  D: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  F: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
}

const SEVERITY_CONFIG = {
  critical: { icon: ShieldAlert, bg: "bg-destructive/5", border: "border-destructive/20", text: "text-destructive", badge: "bg-destructive/10 text-destructive", label: "Critical" },
  warning: { icon: AlertTriangle, bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: "Warning" },
  info: { icon: Info, bg: "bg-primary/5", border: "border-primary/20", text: "text-primary", badge: "bg-primary/10 text-primary", label: "Info" },
}

type UploadedFile = {
  name: string
  content: string
  language: string
  size: number
}

function langFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return EXT_LANG[ext] ?? "auto"
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  return `${(n / 1024).toFixed(1)} KB`
}

export default function CodeCheckerPage() {
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("auto")
  const [context, setContext] = useState("")
  const [model, setModel] = useState(DEFAULT_JUDGE_MODEL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CodeCheckResult | null>(null)
  const [showIssues, setShowIssues] = useState(true)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [activeFileIdx, setActiveFileIdx] = useState<number>(-1)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function readFiles(fileList: FileList) {
    const files = Array.from(fileList).filter((f) => f.size < 200_000)
    if (files.length === 0) return
    const readers = files.map(
      (f) =>
        new Promise<UploadedFile>((resolve) => {
          const reader = new FileReader()
          reader.onload = () =>
            resolve({
              name: f.name,
              content: reader.result as string,
              language: langFromFilename(f.name),
              size: f.size,
            })
          reader.readAsText(f)
        })
    )
    Promise.all(readers).then((results) => {
      setUploadedFiles((prev) => {
        const next = [...prev, ...results]
        const newIdx = prev.length
        activateFile(next, newIdx)
        return next
      })
      setResult(null)
    })
  }

  function activateFile(files: UploadedFile[], idx: number) {
    setActiveFileIdx(idx)
    setCode(files[idx].content)
    setLanguage(files[idx].language)
  }

  function removeFile(idx: number) {
    setUploadedFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (next.length === 0) {
        setActiveFileIdx(-1)
        setCode("")
        setLanguage("auto")
      } else {
        const newIdx = Math.min(idx, next.length - 1)
        activateFile(next, newIdx)
      }
      return next
    })
  }

  function analyzeAllFiles() {
    if (uploadedFiles.length === 0) return
    const combined = uploadedFiles
      .map((f) => `// ====== ${f.name} ======\n${f.content}`)
      .join("\n\n")
    setCode(combined)
    setLanguage("auto")
    setActiveFileIdx(-1)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }, [])

  async function handleAnalyze() {
    if (!code.trim()) return
    setError(null)
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/code-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, context: context || undefined, model }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Analysis failed"); return }
      setResult(data as CodeCheckResult)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  const criticalCount = result?.issues.filter((i) => i.severity === "critical").length ?? 0
  const warningCount = result?.issues.filter((i) => i.severity === "warning").length ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-0.5">
          <h1 className="text-xl font-semibold text-foreground">AI Code Checker</h1>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            <Sparkles className="w-3 h-3" />
            Powered by Groq
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste code or upload files — get quality scores, security issues, and actionable improvements
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* ── Input panel ── */}
        <div className="col-span-3 space-y-3">

          {/* Code input card */}
          <div
            className={cn(
              "bg-card border rounded-lg overflow-hidden transition-colors",
              isDragging ? "border-primary ring-2 ring-primary/20" : "border-border"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Code Input</span>
                {uploadedFiles.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Files className="w-3 h-3" />
                    {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {uploadedFiles.length > 1 && (
                  <button
                    onClick={analyzeAllFiles}
                    title="Concatenate all files into one analysis"
                    className="flex items-center gap-1 h-6 px-2 text-[10px] font-medium text-primary border border-primary/30 rounded bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <Files className="w-3 h-3" /> Merge all
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 h-6 px-2 text-[10px] font-medium text-muted-foreground border border-border rounded hover:bg-muted hover:text-foreground transition-colors"
                >
                  <FolderOpen className="w-3 h-3" /> Browse
                </button>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-6 px-2 text-[10px] border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l === "auto" ? "Auto-detect" : l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File tabs */}
            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/20 overflow-x-auto">
                {uploadedFiles.map((f, i) => (
                  <div
                    key={i}
                    className={cn(
                      "group flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] cursor-pointer transition-colors flex-shrink-0",
                      activeFileIdx === i
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                    )}
                    onClick={() => activateFile(uploadedFiles, i)}
                  >
                    <FileCode2 className="w-3 h-3 flex-shrink-0" />
                    <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                    <span className="text-[9px] opacity-60">{formatBytes(f.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drag overlay hint */}
            {isDragging && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-lg pointer-events-none m-px">
                <Upload className="w-8 h-8 text-primary mb-2" />
                <p className="text-sm font-semibold text-primary">Drop files to upload</p>
              </div>
            )}

            {/* Textarea or drop prompt */}
            {code.trim() === "" && uploadedFiles.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-14 px-4 cursor-pointer text-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Supports .ts .js .py .go .rs .java .c .cpp .cs .rb .php .swift .kt .sql .sh and more</p>
                <p className="text-xs text-muted-foreground/40 mt-3">Or type / paste code below</p>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={"// Paste your AI-generated code here…"}
                  rows={4}
                  spellCheck={false}
                  className="mt-3 w-full px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 bg-transparent focus:outline-none resize-none"
                />
              </div>
            ) : (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={"// Paste your AI-generated code here…\n\nfunction example() {\n  // Your code will be analyzed for quality,\n  // security, patterns, and improvements\n}"}
                rows={22}
                spellCheck={false}
                className="w-full px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 bg-transparent focus:outline-none resize-none leading-relaxed"
              />
            )}

            {/* Drop hint strip at bottom */}
            {(code.trim() !== "" || uploadedFiles.length > 0) && (
              <div
                className="flex items-center justify-center gap-1.5 py-1.5 border-t border-border bg-muted/20 text-[10px] text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3" />
                Drop more files here or click to add
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.c,.cpp,.cc,.cxx,.cs,.php,.rb,.swift,.kt,.kts,.sql,.sh,.bash,.zsh,.txt,.md"
            className="hidden"
            onChange={(e) => { if (e.target.files) { readFiles(e.target.files); e.target.value = "" } }}
          />

          {/* Context */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Context <span className="normal-case font-normal">(optional — describe what the code should do)</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g. This is a Next.js API route that handles user authentication with JWT tokens…"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Model selector */}
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Bot className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Judge Model</span>
              <span className="text-[10px] text-muted-foreground">— the AI that reviews your code</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {GROQ_MODELS.map((m) => {
                const speed = SPEED_CONFIG[m.speed]
                const selected = model === m.id
                return (
                  <label
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-all",
                      selected
                        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:border-border/80 hover:bg-muted/40"
                    )}
                  >
                    <input type="radio" name="model" value={m.id} checked={selected} onChange={() => setModel(m.id)} className="sr-only" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>{m.label}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-medium", speed.color, speed.bg, speed.border)}>
                          {speed.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{m.contextWindow} ctx</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{m.description}</p>
                    </div>
                    <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}>
                      {selected && <div className="w-full h-full rounded-full bg-primary-foreground scale-[0.4]" />}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading || !code.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded-md transition-colors w-full justify-center"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing with Groq…</>
            ) : (
              <><Zap className="w-4 h-4" /> Analyze Code Quality</>
            )}
          </button>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2.5 text-sm text-destructive">{error}</div>
          )}
        </div>

        {/* ── Results panel ── */}
        <div className="col-span-2 space-y-3">
          {!result && !loading && (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Code2 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-xs text-muted-foreground">Paste code and click Analyze to see your quality report</p>
            </div>
          )}

          {loading && (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Running analysis…</p>
              <p className="text-xs text-muted-foreground mt-1">Groq is reviewing your code</p>
            </div>
          )}

          {result && (
            <>
              {/* Score card */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <SemanticScoreRing score={result.overallScore} size={64} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold text-foreground">{result.overallScore}/100</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-sm font-bold border",
                        GRADE_CONFIG[result.grade]?.bg,
                        GRADE_CONFIG[result.grade]?.text,
                        GRADE_CONFIG[result.grade]?.border
                      )}>
                        Grade {result.grade}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {result.detectedLanguage}
                      <span className="mx-1.5 opacity-30">·</span>
                      <span className="font-mono">{GROQ_MODELS.find(m => m.id === model)?.label ?? model}</span>
                    </p>
                    {(criticalCount > 0 || warningCount > 0) && (
                      <div className="flex gap-2 mt-1">
                        {criticalCount > 0 && <span className="text-xs font-medium text-destructive">{criticalCount} critical</span>}
                        {warningCount > 0 && <span className="text-xs font-medium text-amber-500">{warningCount} warnings</span>}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{result.summary}</p>
              </div>

              {/* Metrics */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Metrics</h3>
                <div className="space-y-2">
                  {Object.entries(result.metrics).map(([key, score]) => (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-foreground">{METRIC_LABELS[key] ?? key}</span>
                        <span className={cn("text-xs font-bold tabular-nums",
                          score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-destructive"
                        )}>
                          {score}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-destructive"
                          )}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                  <h3 className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Strengths</h3>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI Patterns */}
              {result.aiGeneratedPatterns.length > 0 && (
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                  <h3 className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    AI-Generated Patterns Detected
                  </h3>
                  <ul className="space-y-1">
                    {result.aiGeneratedPatterns.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-violet-700 dark:text-violet-300">
                        <span className="flex-shrink-0 mt-0.5">◈</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Issues — full width */}
      {result && result.issues.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowIssues((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-foreground">Issues Found</h2>
              <div className="flex gap-1">
                {criticalCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">{criticalCount} critical</span>
                )}
                {warningCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500">{warningCount} warnings</span>
                )}
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                  {result.issues.length} total
                </span>
              </div>
            </div>
            {showIssues ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showIssues && (
            <div className="border-t border-border divide-y divide-border">
              {result.issues.map((issue, i) => {
                const cfg = SEVERITY_CONFIG[issue.severity]
                const Icon = cfg.icon
                return (
                  <div key={i} className={cn("px-4 py-3 flex gap-3", cfg.bg)}>
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon className={cn("w-3.5 h-3.5", cfg.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", cfg.badge)}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground">{issue.category}</span>
                        {issue.line && <span className="text-[10px] font-mono text-muted-foreground/60">line {issue.line}</span>}
                      </div>
                      <p className={cn("text-xs font-semibold mb-1", cfg.text)}>{issue.message}</p>
                      <p className="text-xs text-muted-foreground">{issue.suggestion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Improvements — full width */}
      {result && result.improvements.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suggested Improvements</h2>
          <div className="grid grid-cols-2 gap-2">
            {result.improvements.map((imp, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 bg-primary/5 rounded-md border border-primary/10 text-xs text-foreground">
                <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                {imp}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
