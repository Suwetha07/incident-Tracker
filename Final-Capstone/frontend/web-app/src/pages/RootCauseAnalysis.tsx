import React from 'react';
import { Card, EmptyState, LoadingSpinner } from '../components/shared/Cards';
import { useDeployments } from '../hooks/useApi';

export const RootCauseAnalysis: React.FC = () => {
  const { data: deployments, isLoading } = useDeployments();
  const deploymentRows = (deployments as Array<{status: string, service: string, version: string, id: string}>) || [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const failedDeployments = deploymentRows.filter(d => d.status === 'failed' || d.status === 'rollback');

  if (failedDeployments.length === 0) {
    return (
      <div className="space-y-6">
        <Card title="Root Cause Analysis">
          <EmptyState
            title="No Failed Deployments"
            message="All recent deployments have succeeded. No RCA required."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Root Cause Analysis</h1>
        <p className="mt-2 text-gray-400">Automated AI diagnostics and remediation steps for failed deployments.</p>
      </div>

      {failedDeployments.map((deployment) => (
        <div key={deployment.id} className="overflow-hidden rounded-xl border border-red-900/50 bg-[#0c0414] shadow-2xl">
          <div className="border-b border-red-900/30 bg-gradient-to-r from-red-900/20 to-transparent p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/20 text-red-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </span>
                  {deployment.service}
                </h2>
                <p className="mt-1 text-sm text-gray-400 font-mono">ID: {deployment.id.slice(0, 15)} • Version: {deployment.version}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm font-medium text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                STATUS: {deployment.status.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-2">
            {/* Terminal Window */}
            <div className="flex flex-col rounded-xl border border-gray-800 bg-[#05010a] shadow-lg">
              <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/40 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                <span className="ml-2 text-xs font-medium text-gray-500">application-error.log</span>
              </div>
              <div className="flex-1 overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-gray-300">
                <p className="text-red-400">[ERROR] OCI runtime create failed: container_linux.go:380</p>
                <p className="text-red-400">[ERROR] starting container process caused: exec: "node": executable file not found in $PATH</p>
                <p className="text-orange-400 mt-2">[FATAL] CrashLoopBackOff detected for pod in namespace default</p>
                <p className="text-yellow-400 mt-2">[WARN] Readiness probe failed: connection refused</p>
              </div>
            </div>
            
            {/* AI Diagnostics Block */}
            <div className="space-y-6">
              <div className="group relative overflow-hidden rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-[#0c0414] p-6 shadow-[0_0_30px_rgba(168,85,247,0.1)] transition-all hover:border-purple-500/50 hover:shadow-[0_0_40px_rgba(168,85,247,0.2)]">
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl transition-all group-hover:bg-purple-500/30"></div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <span className="text-purple-400">✨</span> Root Cause Analysis
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-purple-100/80">
                  The container image specified in the deployment does not contain the required <code className="rounded bg-purple-900/40 px-1.5 py-0.5 text-purple-300">node</code> runtime executable in its PATH. This typically happens when the base image was changed from a Node.js image to a minimal Alpine/scratch image without copying the runtime binaries.
                </p>
              </div>

              <div className="rounded-xl border border-blue-900/40 bg-blue-900/10 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Suggested Fixes
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-blue-100/70">
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">1</span>
                    <span>Verify the Dockerfile <code className="rounded bg-black/30 px-1.5 py-0.5 text-gray-300">FROM</code> statement uses a valid Node.js base image (e.g., <code className="rounded bg-black/30 px-1.5 py-0.5 text-blue-300">node:18-alpine</code>).</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">2</span>
                    <span>Ensure the entrypoint command is correctly spelled and executable.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">3</span>
                    <span>Rollback to the previous stable version immediately to restore service availability.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
