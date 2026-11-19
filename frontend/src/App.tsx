import React, { useState, useEffect } from 'react';
import {
  Radio,
  Play,
  Pause,
  Square,
  Flame,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Settings,
  Film,
  ListOrdered,
  RefreshCw,
  Sparkles,
  Sliders,
  Check,
  X,
  Eye,
  Tv,
  Activity
} from 'lucide-react';

interface StreamState {
  stream_id: number | null;
  url: string;
  title: string;
  channel_name: string;
  thumbnail_url: string;
  is_live: boolean;
  status: string;
  error_message: string;
  elapsed_seconds: number;
  buffer_duration: number;
  audio_level: number;
  motion_level: number;
  moments_detected: number;
  clips_generated: number;
}

interface Clip {
  id: number;
  moment_id: number | null;
  title: string;
  hook: string;
  description: string;
  hashtags: string;
  duration: number;
  score: number;
  preset: string;
  status: string;
  status_stage: string;
  progress: number;
  raw_path: string;
  processed_path: string | null;
  thumbnail_path: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  user_action: string;
  created_at: string;
}

interface Stats {
  moments_detected: number;
  clips_generated: number;
  clips_processing: number;
  total_rendered_duration: number;
}

interface PresetConfig {
  id: string;
  name: string;
  description: string;
  font_size: number;
  primary_color: string;
  highlight_color: string;
  zoom_effect: boolean;
  top_hook_banner: boolean;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'monitor' | 'clips' | 'queue' | 'settings'>('overview');
  
  // Stream state
  const [streamUrl, setStreamUrl] = useState('https://www.youtube.com/watch?v=gta6_authorized_live');
  const [isConnecting, setIsConnecting] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>({
    stream_id: null,
    url: '',
    title: 'No Stream Connected',
    channel_name: 'Paste a YouTube livestream URL above',
    thumbnail_url: '',
    is_live: false,
    status: 'IDLE',
    error_message: '',
    elapsed_seconds: 0,
    buffer_duration: 0,
    audio_level: 0,
    motion_level: 0,
    moments_detected: 0,
    clips_generated: 0
  });

  // Clips and Stats
  const [clips, setClips] = useState<Clip[]>([]);
  const [stats, setStats] = useState<Stats>({
    moments_detected: 0,
    clips_generated: 0,
    clips_processing: 0,
    total_rendered_duration: 0
  });
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'APPROVED' | 'REJECTED'>('ALL');

  // Settings & Presets
  const [, setPresets] = useState<Record<string, PresetConfig>>({});
  const [activePreset, setActivePreset] = useState('viral');
  const [scoreThreshold, setScoreThreshold] = useState(65);
  const [bufferDuration, setBufferDuration] = useState(300);

  // Preview Modal
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);

  // Notification / Status banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Poll Stream Status & Stats
  useEffect(() => {
    fetchPresets();
    fetchStats();
    fetchClips();

    const interval = setInterval(() => {
      fetchStreamStatus();
      fetchStats();
      fetchClips();
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedFilter]);

  const fetchStreamStatus = async () => {
    try {
      const res = await fetch('/api/stream/status');
      if (res.ok) {
        const data = await res.json();
        setStreamState(data);
      }
    } catch (e) {
      console.error('Failed to fetch stream status', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats', e);
    }
  };

  const fetchClips = async () => {
    try {
      const res = await fetch(`/api/clips?filter=${selectedFilter}`);
      if (res.ok) {
        const data = await res.json();
        setClips(data.clips || []);
      }
    } catch (e) {
      console.error('Failed to fetch clips', e);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets || {});
        if (data.settings?.active_preset) {
          setActivePreset(data.settings.active_preset);
        }
        if (data.settings?.score_threshold) {
          setScoreThreshold(parseInt(data.settings.score_threshold));
        }
      }
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  // Stream Actions
  const handleConnectStream = async (overrideUrl?: string, isLocal?: boolean) => {
    const targetUrl = overrideUrl || streamUrl;
    if (!targetUrl.trim()) {
      showToast('Please enter a valid YouTube livestream URL.');
      return;
    }

    setIsConnecting(true);
    try {
      const payload: any = { url: targetUrl };
      if (isLocal) {
        payload.local_file = 'test_assets/sample_gta6_gameplay.mp4';
      }
      const res = await fetch('/api/stream/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStreamState(data.state);
        showToast(`Stream connected: ${data.state.title}`);
      } else {
        showToast('Stream connection failed.');
      }
    } catch (e) {
      showToast('Error connecting to stream.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleStartMonitoring = async () => {
    try {
      const res = await fetch('/api/stream/start', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStreamState(data.state);
        showToast('Autonomous AI Monitoring Started');
      }
    } catch (e) {
      showToast('Error starting monitoring.');
    }
  };

  const handlePauseMonitoring = async () => {
    try {
      const res = await fetch('/api/stream/pause', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStreamState(data.state);
        showToast(data.state.status === 'PAUSED' ? 'Monitoring Paused' : 'Monitoring Resumed');
      }
    } catch (e) {
      showToast('Error toggling pause.');
    }
  };

  const handleStopMonitoring = async () => {
    try {
      const res = await fetch('/api/stream/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStreamState(data.state);
        showToast('Monitoring Stopped');
      }
    } catch (e) {
      showToast('Error stopping monitoring.');
    }
  };

  const handleClipAction = async (clipId: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/clips/${clipId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        showToast(`Clip #${clipId} marked as ${action}`);
        fetchClips();
      }
    } catch (e) {
      showToast('Action failed');
    }
  };

  const handleRetryClip = async (clipId: number) => {
    try {
      const res = await fetch(`/api/clips/${clipId}/retry`, { method: 'POST' });
      if (res.ok) {
        showToast(`Retrying render for clip #${clipId}`);
        fetchClips();
      }
    } catch (e) {
      showToast('Retry request failed');
    }
  };

  const handleSaveSettings = async (presetId: string, threshold: number) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_preset: presetId,
          score_threshold: threshold.toString()
        })
      });
      if (res.ok) {
        setActivePreset(presetId);
        setScoreThreshold(threshold);
        showToast('Settings saved successfully');
      }
    } catch (e) {
      showToast('Error saving settings');
    }
  };

  const handleManualClipTrigger = async () => {
    try {
      showToast('Triggering manual high-intensity clip render...');
      const res = await fetch('/api/clips/manual-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: 10.0,
          end_time: 35.0,
          preset: activePreset,
          title: 'MANUAL GTA 6 POLICE ESCAPE',
          hook: 'NO WAY HE PULLED THIS OFF 🚨'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Clip #${data.clip_id} queued for rendering!`);
        fetchClips();
        setActiveTab('queue');
      }
    } catch (e) {
      showToast('Failed to trigger clip generation');
    }
  };

  const formatSeconds = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Toast message */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 9999,
          backgroundColor: '#1f1f28',
          border: '1px solid #383848',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          fontWeight: 600
        }}>
          <Sparkles size={16} color="#3b82f6" />
          {toastMessage}
        </div>
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: 250,
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '24px 16px'
      }}>
        <div>
          {/* Logo / App Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 28, borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: '#181820',
              border: '1px solid #2e2e3c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f4f4f7'
            }}>
              <Film size={20} color="#e11d48" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.02em', color: '#ffffff' }}>GTA VI CLIPPER</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Autonomous AI Studio</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 24 }}>
            {[
              { id: 'overview', label: 'Overview', icon: <Tv size={17} /> },
              { id: 'monitor', label: 'Live Monitor', icon: <Radio size={17} /> },
              { id: 'clips', label: 'Generated Clips', icon: <Film size={17} />, count: clips.length },
              { id: 'queue', label: 'Processing Queue', icon: <ListOrdered size={17} />, count: stats.clips_processing },
              { id: 'settings', label: 'Settings & Presets', icon: <Settings size={17} /> }
            ].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 6,
                    backgroundColor: isActive ? '#1c1c24' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    border: isActive ? '1px solid #2d2d3a' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      backgroundColor: '#272733',
                      color: '#a1a1aa',
                      padding: '2px 6px',
                      borderRadius: 10
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Engine status footer */}
        <div style={{
          backgroundColor: '#14141a',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Engine</span>
            <span className="badge badge-live" style={{ fontSize: 9 }}>FFmpeg + Whisper</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Preset: <strong style={{ color: '#ffffff' }}>{activePreset.toUpperCase()}</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Local Storage: <code className="mono">GTA6-Clips/</code>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'monitor' && 'Live Stream Analysis & Telemetry'}
              {activeTab === 'clips' && 'Generated MP4 Clips'}
              {activeTab === 'queue' && 'Video Processing Queue'}
              {activeTab === 'settings' && 'AI & Rendering Settings'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              Real-time livestream monitoring, multimodal detection, and automated 9:16 vertical video rendering.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={handleManualClipTrigger}
              title="Instantly generate a clip from current buffer"
            >
              <Sparkles size={14} color="#f59e0b" />
              Manual Clip Trigger
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <div className="pulse-dot" style={{ color: streamState.status === 'MONITORING' ? 'var(--accent-green)' : '#71717a' }} />
              <span className="mono">{streamState.status}</span>
            </div>
          </div>
        </div>

        {/* TAB: OVERVIEW OR MONITOR */}
        {(activeTab === 'overview' || activeTab === 'monitor') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* 1. STREAM CONNECTION CARD */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Radio size={18} color="#3b82f6" />
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>1. Livestream Connection</h2>
                </div>
                <div>
                  {streamState.is_live ? (
                    <span className="badge badge-live">
                      <span className="pulse-dot" /> LIVE STREAM READY
                    </span>
                  ) : (
                    <span className="badge badge-offline">OFFLINE / IDLE</span>
                  )}
                </div>
              </div>

              {/* URL Input Bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=STREAM_ID"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: '#101014',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: 13,
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleConnectStream()}
                  disabled={isConnecting}
                >
                  <RefreshCw size={14} className={isConnecting ? 'pulse-dot' : ''} />
                  {isConnecting ? 'Connecting...' : 'Connect Stream'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleConnectStream('test_assets/sample_gta6_gameplay.mp4', true)}
                  title="Loads authorized local GTA 6 sample stream recording for testing"
                >
                  <Film size={14} />
                  Use Authorized Test Stream
                </button>
              </div>

              {/* Stream Preview Info Box */}
              {streamState.stream_id && (
                <div style={{
                  display: 'flex',
                  gap: 18,
                  backgroundColor: '#0c0c0f',
                  border: '1px solid #1c1c24',
                  borderRadius: 8,
                  padding: 14,
                  alignItems: 'center'
                }}>
                  {streamState.thumbnail_url ? (
                    <img
                      src={streamState.thumbnail_url}
                      alt="Stream Thumbnail"
                      style={{ width: 140, height: 78, objectFit: 'cover', borderRadius: 6, border: '1px solid #242430' }}
                    />
                  ) : (
                    <div style={{
                      width: 140,
                      height: 78,
                      backgroundColor: '#161620',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)'
                    }}>
                      <Tv size={24} />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{streamState.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Channel: <strong>{streamState.channel_name}</strong></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }} className="mono">
                      URL: {streamState.url}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-preset">{activePreset.toUpperCase()} PRESET</span>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      Auto-clip threshold: <strong>{scoreThreshold}/100</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. MONITORING CONTROLS & REAL-TIME TELEMETRY */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: 20 }}>
              {/* Monitoring Control Card */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Activity size={18} color="#10b981" />
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>2. Autonomous Monitoring</h2>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button
                    className="btn btn-success"
                    style={{ flex: 1 }}
                    onClick={handleStartMonitoring}
                    disabled={streamState.status === 'MONITORING'}
                  >
                    <Play size={15} />
                    Start Monitoring
                  </button>

                  <button
                    className="btn btn-warning"
                    onClick={handlePauseMonitoring}
                    disabled={streamState.status !== 'MONITORING' && streamState.status !== 'PAUSED'}
                  >
                    <Pause size={15} />
                    {streamState.status === 'PAUSED' ? 'Resume' : 'Pause'}
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={handleStopMonitoring}
                    disabled={streamState.status === 'IDLE' || streamState.status === 'STOPPED'}
                  >
                    <Square size={15} />
                    Stop
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  backgroundColor: '#0c0c0f',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #1a1a22'
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elapsed Time</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 2 }} className="mono">
                      {formatSeconds(streamState.elapsed_seconds)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rolling Buffer</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginTop: 2 }} className="mono">
                      {Math.round(streamState.buffer_duration)}s / 300s
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time AI Analysis Waveforms / Meters */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sliders size={18} color="#f59e0b" />
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Multimodal AI Telemetry</h2>
                  </div>
                  <span className="badge badge-preset">Real-time Ingestion</span>
                </div>

                {/* Audio Energy Meter */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Audio Energy & Peak Burst</span>
                    <span className="mono" style={{ color: '#ffffff' }}>{Math.round(streamState.audio_level)}%</span>
                  </div>
                  <div style={{ height: 8, backgroundColor: '#181822', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${streamState.audio_level}%`,
                      height: '100%',
                      backgroundColor: streamState.audio_level > 70 ? '#ef4444' : '#3b82f6',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Computer Vision Motion Meter */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Visual Motion & Scene Cut Intensity</span>
                    <span className="mono" style={{ color: '#ffffff' }}>{Math.round(streamState.motion_level)}%</span>
                  </div>
                  <div style={{ height: 8, backgroundColor: '#181822', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${streamState.motion_level}%`,
                      height: '100%',
                      backgroundColor: streamState.motion_level > 65 ? '#10b981' : '#f59e0b',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                <div style={{
                  marginTop: 14,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Speech-to-Text: Active (faster-whisper int8)</span>
                  <span>Scene Cuts: Monitored</span>
                </div>
              </div>
            </div>

            {/* 3. STATISTICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Moments Detected', val: stats.moments_detected, icon: <Flame size={16} color="#ef4444" /> },
                { label: 'Clips Generated', val: stats.clips_generated, icon: <Film size={16} color="#10b981" /> },
                { label: 'Clips Processing', val: stats.clips_processing, icon: <RefreshCw size={16} color="#3b82f6" /> },
                { label: 'Total Rendered Duration', val: `${stats.total_rendered_duration}s`, icon: <Clock size={16} color="#f59e0b" /> }
              ].map((stat, i) => (
                <div key={i} className="card" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12 }}>
                    <span>{stat.label}</span>
                    {stat.icon}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', marginTop: 8 }} className="mono">
                    {stat.val}
                  </div>
                </div>
              ))}
            </div>

            {/* 4. RECENT CLIPS PREVIEW LIST */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Film size={18} color="#ffffff" />
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Recent Generated Clips</h2>
                </div>

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ALL', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: selectedFilter === filter ? '#2563eb' : '#181822',
                        color: selectedFilter === filter ? '#ffffff' : 'var(--text-secondary)',
                        border: '1px solid ' + (selectedFilter === filter ? '#3b82f6' : '#272733'),
                        cursor: 'pointer'
                      }}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {clips.length === 0 ? (
                <div style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  backgroundColor: '#0c0c0f',
                  borderRadius: 8,
                  border: '1px dashed #202028'
                }}>
                  <Film size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>No clips generated yet</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Start monitoring or click <strong>"Manual Clip Trigger"</strong> to render a test clip.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {clips.map((clip) => (
                    <div
                      key={clip.id}
                      style={{
                        backgroundColor: '#0d0d12',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                      }}
                    >
                      {/* Video Thumbnail / Preview Container */}
                      <div style={{ position: 'relative', width: '100%', height: 180, backgroundColor: '#14141e' }}>
                        {clip.thumbnail_url ? (
                          <img
                            src={clip.thumbnail_url}
                            alt={clip.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)'
                          }}>
                            {clip.status === 'PROCESSING' ? (
                              <RefreshCw size={24} className="pulse-dot" color="#3b82f6" />
                            ) : (
                              <Film size={24} />
                            )}
                          </div>
                        )}

                        {/* Top Badges */}
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          right: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251, 191, 36, 0.4)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <Flame size={12} />
                            {clip.score}/100
                          </span>

                          <span className="badge badge-preset" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
                            {clip.preset.toUpperCase()}
                          </span>
                        </div>

                        {/* Duration Pill */}
                        <div style={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          backgroundColor: 'rgba(0,0,0,0.8)',
                          color: '#ffffff',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600
                        }} className="mono">
                          {clip.duration}s • 9:16
                        </div>
                      </div>

                      {/* Card Content */}
                      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.3, marginBottom: 4 }}>
                            {clip.title}
                          </div>
                          {clip.hook && (
                            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>
                              "{clip.hook}"
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }} className="mono">
                            {clip.hashtags}
                          </div>
                        </div>

                        {/* Status bar if processing */}
                        {clip.status === 'PROCESSING' && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                              <span>{clip.status_stage}</span>
                              <span className="mono">{clip.progress}%</span>
                            </div>
                            <div style={{ height: 4, backgroundColor: '#1c1c28', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${clip.progress}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                            </div>
                          </div>
                        )}

                        {clip.status === 'FAILED' && (
                          <div style={{ fontSize: 10, color: '#ef4444', marginBottom: 8 }}>
                            Failed: {clip.error_message || 'Rendering error'}
                          </div>
                        )}

                        {/* Card Actions */}
                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid #1a1a24', paddingTop: 10 }}>
                          {clip.status === 'COMPLETED' && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ flex: 1, padding: '6px 10px', fontSize: 11 }}
                                onClick={() => setPreviewClip(clip)}
                              >
                                <Eye size={13} />
                                Preview
                              </button>

                              <a
                                href={clip.video_url || '#'}
                                download
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '6px 10px', fontSize: 11, textDecoration: 'none' }}
                              >
                                <Download size={13} />
                                Download MP4
                              </a>

                              <button
                                style={{
                                  backgroundColor: clip.user_action === 'APPROVED' ? '#10b981' : '#1c1c26',
                                  color: clip.user_action === 'APPROVED' ? '#000000' : 'var(--text-secondary)',
                                  border: '1px solid #2a2a38',
                                  borderRadius: 4,
                                  padding: '6px 8px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleClipAction(clip.id, 'APPROVED')}
                                title="Approve Clip"
                              >
                                <Check size={13} />
                              </button>

                              <button
                                style={{
                                  backgroundColor: clip.user_action === 'REJECTED' ? '#ef4444' : '#1c1c26',
                                  color: clip.user_action === 'REJECTED' ? '#ffffff' : 'var(--text-secondary)',
                                  border: '1px solid #2a2a38',
                                  borderRadius: 4,
                                  padding: '6px 8px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleClipAction(clip.id, 'REJECTED')}
                                title="Reject Clip"
                              >
                                <X size={13} />
                              </button>
                            </>
                          )}

                          {clip.status === 'FAILED' && (
                            <button
                              className="btn btn-warning"
                              style={{ flex: 1, fontSize: 11 }}
                              onClick={() => handleRetryClip(clip.id)}
                            >
                              <RefreshCw size={13} />
                              Retry Render
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: GENERATED CLIPS (Full Gallery) */}
        {activeTab === 'clips' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Clip Library ({clips.length} Total)</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Finished 1080x1920 MP4 files organized in local storage.</p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {(['ALL', 'APPROVED', 'REJECTED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: selectedFilter === filter ? '#2563eb' : '#181822',
                      color: selectedFilter === filter ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid ' + (selectedFilter === filter ? '#3b82f6' : '#272733'),
                      cursor: 'pointer'
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  style={{
                    backgroundColor: '#0d0d12',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'relative', width: '100%', height: 180, backgroundColor: '#14141e' }}>
                    {clip.thumbnail_url && (
                      <img src={clip.thumbnail_url} alt={clip.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <span className="badge badge-preset" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                        SCORE {clip.score}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>{clip.title}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 6 }}>"{clip.hook}"</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }} className="mono">
                      {clip.hashtags}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11 }} onClick={() => setPreviewClip(clip)}>
                        <Eye size={13} />
                        Preview
                      </button>
                      <a href={clip.video_url || '#'} download className="btn btn-primary" style={{ flex: 1, fontSize: 11, textDecoration: 'none' }}>
                        <Download size={13} />
                        Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: PROCESSING QUEUE */}
        {activeTab === 'queue' && (
          <div className="card">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>Video Processing Pipeline</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  style={{
                    backgroundColor: '#0d0d12',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      backgroundColor: clip.status === 'COMPLETED' ? 'var(--accent-green-bg)' : '#181824',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {clip.status === 'COMPLETED' ? (
                        <CheckCircle2 size={18} color="var(--accent-green)" />
                      ) : clip.status === 'FAILED' ? (
                        <AlertCircle size={18} color="#ef4444" />
                      ) : (
                        <RefreshCw size={18} color="#3b82f6" className="pulse-dot" />
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{clip.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Status: <strong style={{ color: clip.status === 'COMPLETED' ? '#10b981' : '#ffffff' }}>{clip.status_stage}</strong> • Preset: {clip.preset}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 140 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        <span>Progress</span>
                        <span className="mono">{clip.progress}%</span>
                      </div>
                      <div style={{ height: 6, backgroundColor: '#1c1c28', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${clip.progress}%`,
                          height: '100%',
                          backgroundColor: clip.status === 'FAILED' ? '#ef4444' : '#10b981'
                        }} />
                      </div>
                    </div>

                    {clip.status === 'FAILED' && (
                      <button className="btn btn-warning" style={{ fontSize: 11 }} onClick={() => handleRetryClip(clip.id)}>
                        Retry
                      </button>
                    )}

                    {clip.status === 'COMPLETED' && (
                      <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setPreviewClip(clip)}>
                        Preview
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SETTINGS & PRESETS */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Presets Selection */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>Three Automatic Editing Presets</h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Select how clips are reframed, styled, and rendered for social media platforms.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  {
                    id: 'viral',
                    name: 'PRESET A: VIRAL GAMING',
                    features: [
                      'Dynamic word-by-word subtitles',
                      'Neon highlighted keywords',
                      'Subtle dynamic zoom pulse',
                      'Strong opening hook banner',
                      'High-energy audio loudnorm',
                      'Optimized for TikTok & Shorts'
                    ]
                  },
                  {
                    id: 'clean',
                    name: 'PRESET B: CLEAN GAMEPLAY',
                    features: [
                      'Minimal clean subtitle typography',
                      'Crisp centered 9:16 gameplay framing',
                      'Original unaltered gameplay audio',
                      'Smooth transitions',
                      'No distracting banners or effects'
                    ]
                  },
                  {
                    id: 'cinematic',
                    name: 'PRESET C: CINEMATIC GTA',
                    features: [
                      'Cinematic reframing & color grading',
                      'Subtle slow push-in zoom',
                      'Elegant minimalist captions with gold accents',
                      'Rich enhanced spatial audio',
                      'Professional showcase presentation'
                    ]
                  }
                ].map((p) => {
                  const isSelected = activePreset === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSaveSettings(p.id, scoreThreshold)}
                      style={{
                        backgroundColor: isSelected ? '#181824' : '#0e0e13',
                        border: '1px solid ' + (isSelected ? '#3b82f6' : 'var(--border)'),
                        borderRadius: 10,
                        padding: 18,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#60a5fa' : '#ffffff' }}>
                          {p.name}
                        </span>
                        {isSelected && <Check size={16} color="#3b82f6" />}
                      </div>

                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        {p.features.map((feat, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: isSelected ? '#3b82f6' : '#5e6473' }} />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Threshold & Rolling Buffer Config */}
            <div className="card">
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 16 }}>AI Clip Selection & Buffer Settings</h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>Minimum AI Entertainment Score</span>
                    <span className="mono" style={{ color: '#f59e0b', fontWeight: 700 }}>{scoreThreshold} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    value={scoreThreshold}
                    onChange={(e) => setScoreThreshold(parseInt(e.target.value))}
                    onMouseUp={() => handleSaveSettings(activePreset, scoreThreshold)}
                    style={{ width: '100%', accentColor: '#3b82f6' }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Clips scoring at or above this threshold will be automatically extracted, reframed, captioned, and rendered.
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: '#ffffff', fontWeight: 600 }}>Rolling Buffer Duration</span>
                    <span className="mono" style={{ color: '#3b82f6', fontWeight: 700 }}>{bufferDuration / 60} minutes</span>
                  </div>
                  <input
                    type="range"
                    min="180"
                    max="360"
                    step="30"
                    value={bufferDuration}
                    onChange={(e) => setBufferDuration(parseInt(e.target.value))}
                    style={{ width: '100%', accentColor: '#3b82f6' }}
                  />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Maintains recent stream buffer in memory/disk to preserve pre-event context and aftermath.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* VIDEO PREVIEW MODAL */}
      {previewClip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: 24
        }}>
          <div style={{
            backgroundColor: '#121218',
            border: '1px solid var(--border)',
            borderRadius: 14,
            width: 840,
            maxWidth: '95vw',
            maxHeight: '90vh',
            display: 'flex',
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.7)'
          }}>
            {/* Left: 9:16 Vertical Video Player */}
            <div style={{
              width: 380,
              backgroundColor: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <video
                src={previewClip.video_url || ''}
                controls
                autoPlay
                loop
                style={{ width: '100%', maxHeight: '85vh', objectFit: 'contain' }}
              />
            </div>

            {/* Right: Clip Details & Export Actions */}
            <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span className="badge badge-preset" style={{ marginBottom: 6 }}>{previewClip.preset.toUpperCase()} PRESET</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>{previewClip.title}</h3>
                  </div>
                  <button
                    onClick={() => setPreviewClip(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 4
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div style={{
                  backgroundColor: '#0d0d12',
                  border: '1px solid #1c1c26',
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hook Caption</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f59e0b', marginTop: 2 }}>"{previewClip.hook}"</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                  <div style={{ backgroundColor: '#0d0d12', padding: 10, borderRadius: 6, border: '1px solid #1c1c24' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AI Score</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }} className="mono">{previewClip.score}/100</div>
                  </div>
                  <div style={{ backgroundColor: '#0d0d12', padding: 10, borderRadius: 6, border: '1px solid #1c1c24' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Resolution</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }} className="mono">1080 × 1920</div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Hashtags: <code className="mono" style={{ color: '#9ba1b0' }}>{previewClip.hashtags}</code>
                </div>
              </div>

              {/* Download / Close Buttons */}
              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid #1c1c26', paddingTop: 20 }}>
                <a
                  href={previewClip.video_url || '#'}
                  download
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px 18px', textDecoration: 'none' }}
                >
                  <Download size={15} />
                  Download Finished MP4
                </a>
                <button className="btn btn-secondary" onClick={() => setPreviewClip(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
