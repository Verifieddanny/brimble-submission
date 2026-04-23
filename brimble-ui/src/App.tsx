import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  Trash2, Terminal, X, Play, LayoutDashboard,
  Search, CheckCircle2,
  AlertCircle,
} from 'lucide-react'

interface Deployment {
  id: string;
  gitUrl: string;
  status: 'running' | 'failed' | 'building';
  imageTag: string | null;
  liveUrl: string | null;
  port: number;
  containerId: string | null;
  logs: string;
  createdAt: string; 
  updatedAt: string;
}

export default function App() {
  const queryClient = useQueryClient()
  const [gitUrl, setGitUrl] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [streamedLogs, setStreamedLogs] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  const { data: deployments } = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: async () => {
      const res = await axios.get('/api/deployments')
      return Array.isArray(res.data) ? res.data : []
    },
    refetchInterval: 3000
  })

  const deployMutation = useMutation({
    mutationFn: (url: string) => axios.post('/api/deployments', { git_url: url }),
    onSuccess: () => {
      setGitUrl('')
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/deployments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deployments'] })
  })

  useEffect(() => {
    if (!selectedId) return;
    setStreamedLogs([]);
    const eventSource = new EventSource(`/api/deployments/${selectedId}/logs`);
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setStreamedLogs(prev => [...prev, data.line || e.data]);
      } catch { setStreamedLogs(prev => [...prev, e.data]); }
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [selectedId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamedLogs]);

  const formatTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${Math.floor((seconds % 3600) / 60)}m ago`;
  }

  const stats = [
    { label: 'TOTAL DEPLOYMENTS', value: deployments?.length || 0 },
    { label: 'ACTIVE NODES', value: deployments?.filter(d => d.status === 'running').length || 0 },
    // { label: 'UPTIME', value: '99.99%', color: 'text-green-500' },
    // { label: 'SUCCESS RATE', value: '98.2%' },
  ];

  return (
    <div className="flex min-h-screen bg-black text-[#888] font-mono uppercase text-[11px] selection:bg-white/20 w-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 flex-col hidden lg:flex">
        <div className="p-6 mb-8">
          <h1 className="text-white text-lg font-bold tracking-tighter">Brimble</h1>
        </div>
        <nav className="flex-1">
          <div className="relative flex items-center px-6 py-3 text-white bg-white/5 border-r-2 border-white">
            <LayoutDashboard size={18} className="mr-3" />
            <span className="font-bold tracking-widest">Deployments</span>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-8">
            <span className="text-white font-black text-sm tracking-[0.2em]">SYS_MONITOR</span>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex gap-6 text-[10px] font-bold">
              <span className="text-white border-b-2 border-white pb-5 mt-5">DEPLOYMENTS</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <div key={i} className="border border-white/10 p-6 bg-white/2">
                <p className="text-[9px] font-bold tracking-widest mb-4">{stat.label}</p>
                <p className={`text-3xl font-light text-white`}>{stat.value}</p>
              </div>
            ))}
          </section>

          {/* New Deployment Input Area (Integrated into theme) */}
            <section className="border border-white/10 p-1 bg-white/2">
              <div className="flex gap-1">
              <input
                type="text"
                placeholder="SOURCE_GIT_URL..."
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                className="flex-1 bg-black border border-white/5 px-4 py-3 text-white focus:outline-none focus:border-white/20 transition-all"
              />
              <button
                onClick={() => deployMutation.mutate(gitUrl)}
                disabled={deployMutation.isPending || !gitUrl}
                className="bg-white/5 hover:bg-white/10 text-white px-8 font-bold border border-white/5 transition-all flex items-center gap-3"
              >
                <Play size={14} fill="currentColor" /> INITIATE_BUILD
              </button>
            </div>
          </section>

          {/* Deployments List */}
          <section className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white font-bold tracking-[0.2em]">ACTIVE DEPLOYMENTS</h2>
              <div className="flex gap-2">
                <button className="px-4 py-1 border border-white/10 bg-white/5 text-[9px] hover:text-white">FILTER: ALL</button>
                <button className="px-4 py-1 border border-white/10 bg-white/5 text-[9px] hover:text-white">SORT: NEWEST</button>
              </div>
            </div>

            <div className="border border-white/10 divide-y divide-white/10 bg-white/1">
              {deployments?.map((d) => (
                <div key={d.id} className="flex flex-col md:flex-row md:items-center p-6 hover:bg-white/3 transition-all group gap-4 md:gap-0">
                  <div className="flex items-center justify-between md:w-12">
                    <div className="w-8">
                      {d.status === 'running' && <CheckCircle2 className="text-green-500" size={20} />}
                      {d.status === 'failed' && <AlertCircle className="text-red-500" size={20} />}
                      {d.status === 'building' && <div className="w-5 h-5 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />}
                    </div>

                    {/* Mobile-only Actions */}
                    <div className="flex md:hidden gap-2">
                      <button onClick={() => setSelectedId(d.id)} className="p-2 text-gray-400">
                        <Terminal size={18} />
                      </button>
                      <button onClick={() => deleteMutation.mutate(d.id)} className="p-2 text-gray-400">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-y-4 md:gap-4 items-center">
                    {/* Identifier */}
                    <div className="col-span-2 md:col-span-1">
                      <a
                        href={d.liveUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white underline font-bold text-xs mb-1 lowercase block"
                      >
                        {d.id}
                      </a>
                      <p className="text-[9px] text-gray-600 font-mono truncate">sha256:{d.id.slice(0, 10)}..90</p>
                    </div>

                    {/* Tag */}
                    <div className="text-gray-500 font-mono text-[9px] md:text-[10px]">
                      <p className="text-[9px] text-gray-600 mb-1 md:hidden">VERSION</p>
                      {d.imageTag || 'v1.0.0-stable'}
                    </div>

                    {/* Status */}
                    <div>
                      <p className="text-[9px] text-gray-600 mb-1">STATUS</p>
                      <p className={`font-bold text-[10px] md:text-xs ${d.status === 'running' ? 'text-green-500' :
                          d.status === 'failed' ? 'text-red-500' : 'text-orange-500'
                        }`}>{d.status.toUpperCase()}</p>
                    </div>

                    {/* Time */}
                    <div>
                      <p className="text-[9px] text-gray-600 mb-1">DEPLOYED</p>
                      <p className="text-white font-bold text-[10px] md:text-xs">{formatTimeAgo(d.createdAt)}</p>
                    </div>
                  </div>

                  {/* Desktop-only Actions */}
                  <div className="hidden md:flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <button type='button' title='terminal' onClick={() => setSelectedId(d.id)} className="p-2 hover:text-white transition-colors">
                      <Terminal size={16} />
                    </button>
                    <button type='button' title='delete' onClick={() => deleteMutation.mutate(d.id)} className="p-2 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Terminal Output Area (Fixed Bottom like Image) */}
        {selectedId && (
          <div className="h-80 border-t border-white/20 bg-black flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="px-6 py-2 border-b border-white/10 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-green-500">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  TERMINAL OUTPUT
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">service: {selectedId}</span>
              </div>
              <div className="flex gap-4 text-gray-500">
                <Search size={14} className="cursor-pointer hover:text-white" />
                <X size={14} className="cursor-pointer hover:text-white" onClick={() => setSelectedId(null)} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] leading-relaxed lowercase bg-black/80 custom-scrollbar">
              {streamedLogs.length === 0 ? (
                <div className="text-gray-700 animate-pulse">[system] establishing link...</div>
              ) : (
                streamedLogs.map((log, i) => (
                  <div key={i} className="mb-1 flex gap-4">
                    <span className="text-gray-700 shrink-0">[{new Date().toISOString().split('T')[1].slice(0, 8)}]</span>
                    <span className={
                      log.includes('WARN') ? 'text-orange-400' :
                        log.includes('SUCCESS') ? 'text-green-500' :
                          log.includes('EXEC') ? 'text-blue-400' : 'text-gray-400'
                    }>
                      {log}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}