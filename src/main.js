import {
  fetchCapabilities,
  fetchStats,
  fetchProjects,
  createProject,
  fetchProject,
  duplicateProject,
  deleteProject,
  uploadMedia,
  importLocalPath,
  triggerProxy,
  startTranscription,
  fetchTranscript,
  patchSegmentText,
  searchTranscript,
  cancelJob,
  fetchProposedCuts,
  createProposedCut,
  updateProposedCut,
  deleteProposedCut,
  getTranscriptExportUrl
} from './services/api.js';

import { wsClient } from './services/websocket.js';
import { secondsToTimecode, formatTimestampMs, formatDuration, formatBytes } from './utils/timecode.js';

// ============================================================================
// State Management
// ============================================================================
const state = {
  currentView: 'home', // 'home' or 'editor'
  projects: [],
  selectedProject: null,
  activeProjectDetails: null,
  selectedMedia: null,
  activeFilter: 'all',
  searchQuery: '',
  stats: null,
  capabilities: null,
  
  // Editor State
  transcript: null,
  activeSegmentId: null,
  activeWordId: null,
  isUserScrollingTranscript: false,
  transcriptScrollTimeout: null,
  transcriptSearchQuery: '',
  transcriptSearchHits: [],
  activeTranscriptTab: 'original', // 'original', 'romanized', 'translation'
  proposedCuts: [],

  // Video Player State
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  playbackRate: 1.0,
  isMuted: false,
  volume: 1.0,
  selectedAspect: 'original', // '16:9', '9:16', '1:1', '4:5', 'original'
  selectedSafeZone: 'none', // 'instagram', 'tiktok', 'youtube', 'none'
  streamMode: 'source', // 'source' or 'proxy'

  // Transcribe Panel State
  selectedModel: 'small',
  selectedLanguage: 'auto',
  activeJob: null, // Current background job
  activeJobsList: [],

  // Command History for Undo/Redo
  undoStack: [],
  redoStack: []
};

// ============================================================================
// Command Pattern for Transcript Editing Undo/Redo
// ============================================================================
class EditSegmentCommand {
  constructor(transcriptId, segmentId, oldText, newText) {
    this.transcriptId = transcriptId;
    this.segmentId = segmentId;
    this.oldText = oldText;
    this.newText = newText;
  }

  async execute() {
    return await patchSegmentText(this.transcriptId, this.segmentId, this.newText);
  }

  async undo() {
    return await patchSegmentText(this.transcriptId, this.segmentId, this.oldText);
  }
}

async function executeCommand(cmd) {
  try {
    const res = await cmd.execute();
    state.undoStack.push(cmd);
    state.redoStack = []; // Clear redo stack on new action
    await reloadCurrentTranscript();
    updateUndoRedoButtons();
    showToast('Edit applied');
    return res;
  } catch (err) {
    showToast(`Edit failed: ${err.message}`);
  }
}

async function undoLastCommand() {
  if (state.undoStack.length === 0) return;
  const cmd = state.undoStack.pop();
  try {
    await cmd.undo();
    state.redoStack.push(cmd);
    await reloadCurrentTranscript();
    updateUndoRedoButtons();
    showToast('Undo successful');
  } catch (err) {
    showToast(`Undo failed: ${err.message}`);
  }
}

async function redoLastCommand() {
  if (state.redoStack.length === 0) return;
  const cmd = state.redoStack.pop();
  try {
    await cmd.execute();
    state.undoStack.push(cmd);
    await reloadCurrentTranscript();
    updateUndoRedoButtons();
    showToast('Redo successful');
  } catch (err) {
    showToast(`Redo failed: ${err.message}`);
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo-transcript');
  const redoBtn = document.getElementById('btn-redo-transcript');
  if (undoBtn) undoBtn.disabled = state.undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
}

// ============================================================================
// Initialization
// ============================================================================
async function initApp() {
  // Connect WebSocket
  wsClient.connect();
  wsClient.subscribe(handleWebSocketEvent);

  // Setup Keyboard Shortcuts
  window.addEventListener('keydown', handleGlobalKeydown);

  try {
    const [caps, stats, projs] = await Promise.all([
      fetchCapabilities(),
      fetchStats(),
      fetchProjects('all')
    ]);
    state.capabilities = caps;
    state.stats = stats;
    state.projects = projs;
    if (projs.length > 0) {
      state.selectedProject = projs[0];
    }
  } catch (e) {
    console.warn('Initial load error:', e);
  }

  render();
}

// ============================================================================
// WebSocket Event Dispatcher
// ============================================================================
function handleWebSocketEvent(data) {
  if (!data || !data.type) return;

  if (data.type === 'job_queued' || data.type === 'job_progress') {
    state.activeJob = data;
    const existing = state.activeJobsList.find(j => j.job_id === data.job_id);
    if (existing) {
      Object.assign(existing, data);
    } else {
      state.activeJobsList.unshift(data);
    }
    updateJobProgressUI(data);
  }

  if (data.type === 'transcript_segment') {
    // Live segment streaming from faster-whisper
    if (state.selectedMedia && data.media_id === state.selectedMedia.id) {
      appendLiveSegment(data.segment);
    }
  }

  if (data.type === 'job_completed') {
    if (state.activeJob && state.activeJob.job_id === data.job_id) {
      state.activeJob.status = 'completed';
      state.activeJob.progress = 100.0;
    }
    showToast(data.message || 'Job completed');
    if (data.job_type === 'transcription') {
      reloadCurrentTranscript();
    }
    if (state.currentView === 'home') {
      refreshHomeData();
    }
  }

  if (data.type === 'job_failed') {
    showToast(`Error: ${data.message || 'Job failed'}`);
    updateJobProgressUI(data);
  }
}

function appendLiveSegment(seg) {
  if (!state.transcript) {
    state.transcript = { segments: [seg], words: seg.words || [] };
    renderTranscriptSegments();
    return;
  }
  const exists = state.transcript.segments.some(s => s.id === seg.id);
  if (!exists) {
    state.transcript.segments.push(seg);
    if (seg.words) {
      state.transcript.words = state.transcript.words.concat(seg.words);
    }
    renderTranscriptSegments();
    // Auto scroll to latest segment if streaming
    const container = document.getElementById('segments-container');
    if (container && !state.isUserScrollingTranscript) {
      container.scrollTop = container.scrollHeight;
    }
  }
}

// ============================================================================
// Render Coordinator
// ============================================================================
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <div class="studio-canvas">
      ${renderTopNavbar()}
      ${state.currentView === 'home' ? renderHomeDashboard() : renderEditorWorkspace()}
      <footer class="privacy-footer-banner">
        🔒 <span>Your media stays on this computer. Local AI & offline processing.</span>
      </footer>
    </div>
    <div id="toast-root" class="toast-container"></div>
  `;

  attachEventHandlers();
}

// ----------------------------------------------------------------------------
// Navbar Component
// ----------------------------------------------------------------------------
function renderTopNavbar() {
  const isAppleSil = state.capabilities?.apple_silicon;
  const hwNote = isAppleSil ? 'VideoToolbox (HW) / CPU int8' : 'CPU Software';

  return `
    <header class="top-navbar">
      <div class="brand-section">
        <span class="brand-icon">✦</span>
        <span>TANEDIT AI</span>
      </div>

      <nav class="pill-nav-container">
        <button class="nav-pill ${state.currentView === 'home' ? 'active' : ''}" id="nav-btn-home">
          <span class="pill-dot"></span>
          <span>⚡ Projects</span>
        </button>
        <button class="nav-pill ${state.currentView === 'editor' ? 'active' : ''}" id="nav-btn-editor">
          <span>Studio Editor</span>
        </button>
        <button class="nav-pill" id="nav-btn-media" style="color: #64748b;">
          <span>Media Library</span>
        </button>
        <button class="nav-pill" id="nav-btn-tools" style="color: #64748b;">
          <span>AI Tools</span>
        </button>
      </nav>

      <div class="top-utilities">
        <div class="badge-tag" title="${state.capabilities?.whisper_note || 'Hardware Engine'}" style="background-color: #161b24; color: var(--accent-lime); border: 1px solid var(--border-dark); font-family: var(--font-mono); font-size: 0.72rem; padding: 6px 10px;">
          ⚡ ${hwNote}
        </div>
        <button class="icon-btn-round" id="btn-search-cmd" title="Command Palette (Cmd+K)">
          🔍
        </button>
        <button class="icon-btn-round" id="btn-jobs-drawer" title="Processing Drawer">
          ⏳
        </button>
        <div class="avatar-chip">TE</div>
      </div>
    </header>
  `;
}

// ----------------------------------------------------------------------------
// Home Dashboard View (Phase 1)
// ----------------------------------------------------------------------------
function renderHomeDashboard() {
  const stats = state.stats || {
    total_footage_formatted: '0h 0m',
    time_saved_formatted: '0m',
    silence_removed_formatted: '0m',
    total_projects: 0,
    draft_projects: 0,
    exported_projects: 0
  };

  const sel = state.selectedProject;

  return `
    <div class="home-view-container">
      <div class="subheader">
        <div class="subheader-title-group">
          <div>
            <h1 class="page-title">Welcome back 👋</h1>
            <p class="page-subtitle">Create clean, captioned videos faster.</p>
          </div>
        </div>
        <div class="subheader-actions">
          <button class="btn-dark-pill" id="btn-import-local-home">
            📁 Import by Path
          </button>
          <button class="btn-lime" id="btn-new-project">
            + New Project
          </button>
        </div>
      </div>

      <!-- Top Bento Grid -->
      <div class="bento-grid-top">
        <div class="bento-card bento-card-left">
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-label">Footage processed</span>
              <span class="stat-value">${stats.total_footage_formatted}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Time saved (AI)</span>
              <span class="stat-value" style="color: var(--accent-lime);">${stats.time_saved_formatted}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Silence removed</span>
              <span class="stat-value">${stats.silence_removed_formatted}</span>
            </div>
          </div>

          <div class="timeline-activity-bar">
            <div class="timeline-months">
              <span>Ingest</span>
              <span>Proxy</span>
              <span>VAD Cut</span>
              <span>Captions</span>
              <span>Master</span>
            </div>
            <div class="timeline-track-container">
              <div class="track-segment active-lime"></div>
              <div class="track-segment active-lime"></div>
              <div class="track-segment semi-active"></div>
              <div class="track-segment"></div>
              <div class="track-segment"></div>
            </div>
            <div class="timeline-avatars-row">
              <div class="avatar-stack">
                <div class="avatar-stack-item">4K</div>
                <div class="avatar-stack-item">MKV</div>
                <div class="avatar-stack-item">AI</div>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8;">Local Pipeline Ready</span>
            </div>
          </div>
        </div>

        <div class="bento-card bento-card-right">
          <div class="engine-header">
            <div>
              <div class="engine-title">Hardware Acceleration</div>
              <div class="engine-value">Apple Silicon</div>
            </div>
            <span class="badge-tag" style="background-color: rgba(198, 241, 53, 0.15); color: var(--accent-lime);">VideoToolbox Active</span>
          </div>
          <div class="hardware-card-strip">
            <div class="hw-slot">
              <span class="hw-code">#4443</span>
              <span>ProRes</span>
            </div>
            <div class="hw-slot active-lime">
              <span class="hw-code">#177210</span>
              <span>H.264 HW</span>
            </div>
            <div class="hw-slot">
              <span class="hw-code">#711221</span>
              <span>Whisper CPU</span>
            </div>
            <button class="btn-white-pill" id="btn-quick-import">Import Media</button>
          </div>
        </div>
      </div>

      <!-- Quick Tools Strip -->
      <div class="quick-tools-strip">
        ${renderQuickTools()}
      </div>

      <!-- Filter Bar & Segmented Control -->
      <div class="filter-tabs-wrapper">
        <div class="filter-bar">
          <div class="filter-group-left">
            <span class="active-filters-pill">⚡ Active filters 2</span>
            <button class="filter-pill-dropdown">All Formats ▾</button>
            <button class="filter-pill-dropdown">Sort by Date ▾</button>
          </div>
          <div class="search-input-capsule">
            <span>🔍</span>
            <input type="text" id="project-search-input" placeholder="Search projects..." value="${state.searchQuery}">
          </div>
        </div>

        <div class="notched-tabs-row">
          <div class="notched-segmented-control">
            <button class="notched-tab-btn ${state.activeFilter === 'all' ? 'active' : ''}" data-filter="all">
              <span>All Projects</span>
              <span class="tab-counter">${stats.total_projects}</span>
            </button>
            <button class="notched-tab-btn ${state.activeFilter === 'draft' ? 'active' : ''}" data-filter="draft">
              <span>Draft</span>
              <span class="tab-counter">${stats.draft_projects}</span>
            </button>
            <button class="notched-tab-btn ${state.activeFilter === 'exported' ? 'active' : ''}" data-filter="exported">
              <span>Exported</span>
              <span class="tab-counter">${stats.exported_projects}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Centerpiece: White List Panel with Embedded Dark Detail Card -->
      <div class="white-projects-panel">
        <div class="panel-list-section">
          <h2 class="panel-list-header">Projects Library</h2>
          <div class="project-list-items">
            ${state.projects.length === 0 ? `
              <div class="empty-projects-state">
                <p>No projects found. Click <strong>+ New Project</strong> to get started.</p>
              </div>
            ` : state.projects.map(p => `
              <div class="project-item-row ${sel && sel.id === p.id ? 'selected' : ''}" data-project-id="${p.id}">
                <div class="item-left-group">
                  <div class="item-thumbnail">
                    ${p.thumbnail_path ? `<img src="${p.thumbnail_path}" alt="Thumb" />` : '🎬'}
                  </div>
                  <div class="item-text-info">
                    <span class="item-id"># ${p.id}</span>
                    <span class="item-name" style="font-size: 0.82rem; font-weight: 600;">${p.name}</span>
                    <span class="item-date">${p.aspect_ratio || '16:9'} • ${p.fps || 30} fps</span>
                  </div>
                </div>
                <div class="item-right-group">
                  <span class="status-pill ${p.status || 'draft'}">${p.status || 'draft'}</span>
                  <span class="item-amount">${formatDuration(p.total_duration || p.duration || 0)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Embedded Dark Detail Card -->
        <div class="dark-detail-card">
          ${sel ? `
            <div>
              <div class="detail-card-header">
                <div class="detail-meta-left">
                  <span class="detail-subheading">Project details</span>
                  <div class="detail-code-row">
                    <span class="detail-code-title"># ${sel.id}</span>
                    <span class="status-pill ${sel.status || 'draft'}">${sel.status || 'draft'}</span>
                  </div>
                </div>
                <div class="detail-middle-col">
                  <span class="detail-subheading">Resolution</span>
                  <span style="font-weight: 700; font-size: 0.95rem;">${sel.width || 1920}x${sel.height || 1080}</span>
                </div>
                <div class="detail-right-customer">
                  <div class="customer-avatar">TE</div>
                  <div class="customer-info">
                    <span class="customer-name">${sel.name}</span>
                    <span class="customer-sub">Local Project</span>
                  </div>
                </div>
              </div>

              <!-- 3 Mini Bento Stat Cards -->
              <div class="mini-bento-stats-grid">
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${formatDuration(sel.total_duration || sel.duration || 0)}</span>
                    <span class="mini-stat-arrow">↗</span>
                  </div>
                  <span class="mini-stat-label">Footage Length</span>
                </div>
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${sel.media_count || 0} clips</span>
                    <span class="mini-stat-arrow">↗</span>
                  </div>
                  <span class="mini-stat-label">Media Items</span>
                </div>
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${sel.fps || 30.0} FPS</span>
                    <span class="mini-stat-arrow">↗</span>
                  </div>
                  <span class="mini-stat-label">Frame Rate</span>
                </div>
              </div>
            </div>

            <!-- Bottom strip -->
            <div class="detail-card-bottom-strip">
              <div class="bottom-metric-item">
                <span class="bottom-metric-label">Timeline Status</span>
                <span class="bottom-metric-val">Ready for Editing</span>
              </div>
              <div class="bottom-actions-group">
                <button class="icon-action-btn" id="btn-duplicate-proj" title="Duplicate Project">⎘</button>
                <button class="icon-action-btn delete-btn" id="btn-delete-proj" title="Delete Project">🗑</button>
                <button class="btn-lime" id="btn-open-in-editor" style="padding: 8px 16px;">
                  <span>Open Studio</span> ▶
                </button>
              </div>
            </div>
          ` : `
            <div style="text-align: center; margin: auto; color: var(--text-muted);">
              Select a project from the left panel to inspect details.
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderQuickTools() {
  const tools = [
    { id: 'tool-auto-edit', icon: '✂️', name: 'Auto Edit' },
    { id: 'tool-auto-caption', icon: '💬', name: 'Auto Captions' },
    { id: 'tool-silence', icon: '🔇', name: 'Remove Silence' },
    { id: 'tool-retakes', icon: '🔄', name: 'Remove Retakes' },
    { id: 'tool-voice', icon: '🎙️', name: 'Voice Enhance' },
    { id: 'tool-video', icon: '✨', name: 'Video Enhance' },
    { id: 'tool-subtitles', icon: '🌐', name: 'Translator' }
  ];

  return tools.map(t => `
    <div class="quick-tool-tile" data-tool="${t.id}">
      <div class="quick-tool-icon">${t.icon}</div>
      <span class="quick-tool-name">${t.name}</span>
    </div>
  `).join('');
}

// ----------------------------------------------------------------------------
// Studio Editor Workspace (Phase 2)
// ----------------------------------------------------------------------------
function renderEditorWorkspace() {
  const proj = state.selectedProject;
  const media = state.selectedMedia;

  return `
    <div class="editor-view-container">
      <!-- Editor Top Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn-dark-pill" id="btn-back-to-home">
            ← Projects
          </button>
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #ffffff;">
              <span style="font-family: var(--font-mono); color: var(--accent-lime);"># ${proj ? proj.id : ''}</span>
              ${proj ? proj.name : 'Untitled Project'}
            </h2>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              ${media ? `${media.file_name} • ${media.width}x${media.height} • ${media.fps} fps` : 'No media selected'}
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="btn-dark-pill" id="btn-editor-import">
            + Import Media
          </button>
          <button class="btn-dark-pill" id="btn-toggle-proposed-cuts">
            ✂️ Proposed Edits (${state.proposedCuts.length})
          </button>
        </div>
      </div>

      <!-- Main Editor Bento Layout -->
      <div class="editor-workspace">
        <!-- Left Column: Video Preview Monitor & Transcribe Setup Panel -->
        <div class="editor-left-column">
          ${renderPreviewMonitorCard()}
          ${renderTranscribePanelCard()}
        </div>

        <!-- Right Column: Transcript Card -->
        <div class="editor-right-column">
          ${renderTranscriptCard()}
        </div>
      </div>

      <!-- Bottom Section: Timeline & Proposed Cuts Drawer -->
      <div class="editor-bottom-section">
        ${renderProposedEditsPanel()}
        ${renderTimelinePlaceholderCard()}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Preview Monitor Card Component
// ----------------------------------------------------------------------------
function renderPreviewMonitorCard() {
  const media = state.selectedMedia;
  const videoSrc = media ? (state.streamMode === 'proxy' && media.proxy_path ? `/api/media/${media.id}/proxy/stream` : `/api/media/${media.id}/stream`) : '';

  return `
    <div class="bento-card" style="padding: 0; overflow: hidden; background-color: #0b0d12;">
      <!-- Monitor Header -->
      <div class="monitor-header">
        <div class="monitor-title-box">
          <span style="font-size: 0.85rem; font-weight: 700;">Studio Monitor</span>
          <span class="badge-tag">${media ? `${media.video_codec || 'Video'} (${media.width}x${media.height})` : 'Empty'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="stream-toggle-pill">
            <button class="stream-toggle-btn ${state.streamMode === 'source' ? 'active' : ''}" data-stream="source">Original</button>
            <button class="stream-toggle-btn ${state.streamMode === 'proxy' ? 'active' : ''}" data-stream="proxy" ${media?.proxy_status !== 'ready' ? 'title="Proxy not yet ready"' : ''}>Proxy (720p)</button>
          </div>
        </div>
      </div>

      <!-- Monitor Viewport Wrapper -->
      <div class="monitor-viewport-wrapper" id="monitor-viewport">
        ${videoSrc ? `
          <video id="studio-video" class="monitor-video" src="${videoSrc}" preload="metadata"></video>
        ` : `
          <div style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">
            <p>No video selected for preview.</p>
            <button class="btn-lime" id="btn-monitor-import" style="margin-top: 10px;">Import Video</button>
          </div>
        `}

        <!-- Floating Timecode HUD -->
        <div class="floating-hud-timecode" id="floating-timecode">
          00:00:00:00
        </div>

        <!-- Aspect Ratio Overlays -->
        <div id="aspect-overlay-box" class="aspect-overlay-box" style="display: none;"></div>

        <!-- Safe Zones Guide -->
        <div id="safe-zone-box" class="safe-zone-guide" style="display: none;"></div>
      </div>

      <!-- Monitor Controls Bar -->
      <div class="monitor-controls-bar">
        <!-- Scrubber -->
        <div class="monitor-scrub-row">
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8;" id="scrub-current-time">00:00</span>
          <input type="range" class="scrub-slider" id="video-scrubber" min="0" max="100" value="0" step="0.05">
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: #94a3b8;" id="scrub-total-duration">00:00</span>
        </div>

        <div class="controls-button-row">
          <div class="controls-left-playback">
            <button class="ctrl-btn" id="btn-frame-back" title="Step Back 1 Frame (Left Arrow)">◀</button>
            <button class="ctrl-btn" id="btn-play-pause" style="min-width: 70px; background-color: var(--accent-lime); color: #0c0e12; font-weight: 700;">▶ Play</button>
            <button class="ctrl-btn" id="btn-frame-fwd" title="Step Forward 1 Frame (Right Arrow)">▶</button>

            <!-- Playback Speed -->
            <select class="custom-select" id="select-playback-speed" style="padding: 4px 8px; font-size: 0.75rem; margin-left: 6px;">
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1.0" selected>1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>

            <!-- Aspect Overlay Selector -->
            <select class="custom-select" id="select-aspect-overlay" style="padding: 4px 8px; font-size: 0.75rem; margin-left: 4px;">
              <option value="original">Aspect: Fit</option>
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Reels/TikTok)</option>
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5 (Portrait)</option>
            </select>

            <!-- Safe Zone Selector -->
            <select class="custom-select" id="select-safe-zone" style="padding: 4px 8px; font-size: 0.75rem; margin-left: 4px;">
              <option value="none">Safe Zone: Off</option>
              <option value="instagram">Instagram Reels</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube Shorts</option>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button class="ctrl-btn" id="btn-volume-mute" title="Mute/Unmute">🔊</button>
            <input type="range" id="volume-slider" min="0" max="1" step="0.05" value="1" style="width: 70px; accent-color: var(--accent-lime);">
            <button class="ctrl-btn" id="btn-fullscreen" title="Fullscreen">⛶</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Transcribe Panel Card Component
// ----------------------------------------------------------------------------
function renderTranscribePanelCard() {
  const media = state.selectedMedia;
  const isAppleSil = state.capabilities?.apple_silicon;
  const whisperNote = isAppleSil 
    ? "Apple Silicon CPU (int8). Note: CTranslate2/faster-whisper has no MPS backend; CPU int8 is optimal."
    : "CTranslate2 faster-whisper CPU (int8)";

  return `
    <div class="transcribe-panel-card">
      <div class="transcribe-card-header">
        <h3 class="transcribe-title">
          <span>🎙️</span>
          <span>Local AI Transcription</span>
        </h3>
        <span class="badge-tag" style="background-color: rgba(198, 241, 53, 0.15); color: var(--accent-lime);">faster-whisper</span>
      </div>

      <div class="transcribe-config-grid">
        <div class="config-field">
          <label class="config-label">Model Size</label>
          <select class="custom-select" id="select-whisper-model">
            <option value="tiny" ${state.selectedModel === 'tiny' ? 'selected' : ''}>Tiny (~75MB) • 10x Speed</option>
            <option value="base" ${state.selectedModel === 'base' ? 'selected' : ''}>Base (~150MB) • 7x Speed</option>
            <option value="small" ${state.selectedModel === 'small' ? 'selected' : ''}>Small (~500MB) • 4x (Recommended)</option>
            <option value="medium" ${state.selectedModel === 'medium' ? 'selected' : ''}>Medium (~1.5GB) • 2x Accurate</option>
            <option value="large-v3" ${state.selectedModel === 'large-v3' ? 'selected' : ''}>Large-v3 (~3GB) • State of Art</option>
          </select>
        </div>

        <div class="config-field">
          <label class="config-label">Spoken Language</label>
          <select class="custom-select" id="select-whisper-language">
            <option value="auto" ${state.selectedLanguage === 'auto' ? 'selected' : ''}>Auto Detect</option>
            <option value="en" ${state.selectedLanguage === 'en' ? 'selected' : ''}>English</option>
            <option value="ta" ${state.selectedLanguage === 'ta' ? 'selected' : ''}>Tamil (தமிழ்)</option>
            <option value="hi" ${state.selectedLanguage === 'hi' ? 'selected' : ''}>Hindi (हिन्दी)</option>
            <option value="te" ${state.selectedLanguage === 'te' ? 'selected' : ''}>Telugu (తెలుగు)</option>
            <option value="ml" ${state.selectedLanguage === 'ml' ? 'selected' : ''}>Malayalam (മലയാളം)</option>
            <option value="kn" ${state.selectedLanguage === 'kn' ? 'selected' : ''}>Kannada (ಕನ್ನಡ)</option>
            <option value="bn" ${state.selectedLanguage === 'bn' ? 'selected' : ''}>Bengali (বাংলা)</option>
          </select>
        </div>

        <button class="btn-lime" id="btn-start-transcribe" ${!media ? 'disabled' : ''} style="height: 38px;">
          Transcribe Now
        </button>
      </div>

      <div class="device-badge-note">
        💡 <strong>Device Selection:</strong> ${whisperNote}
      </div>

      <!-- Real Job Progress Stepper -->
      <div class="job-progress-stepper" id="job-progress-stepper" style="${state.activeJob && state.activeJob.status === 'running' ? '' : 'display: none;'}">
        <div class="stepper-header">
          <span id="stepper-status-msg">${state.activeJob?.message || 'Processing...'}</span>
          <span id="stepper-pct" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-lime);">${Math.round(state.activeJob?.progress || 0)}%</span>
        </div>
        <div class="stepper-steps-row">
          <div class="step-chip ${state.activeJob?.step === 'extracting_audio' ? 'active' : ''}" id="step-extract">1. Audio Extract</div>
          <div class="step-chip ${state.activeJob?.step === 'loading_model' ? 'active' : ''}" id="step-model">2. Load Model</div>
          <div class="step-chip ${state.activeJob?.step === 'transcribing' ? 'active' : ''}" id="step-transcribe">3. Transcribing</div>
        </div>
        <div class="real-progress-bar">
          <div class="real-progress-fill" id="stepper-progress-fill" style="width: ${state.activeJob?.progress || 0}%;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button class="btn-icon-tiny" id="btn-cancel-job" style="color: #f87171;">✕ Cancel Job</button>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Transcript Card Component
// ----------------------------------------------------------------------------
function renderTranscriptCard() {
  const tr = state.transcript;
  const segments = tr?.segments || [];

  return `
    <div class="transcript-card" id="transcript-card">
      <!-- Notched Segmented Control: Original / Romanized / Translation -->
      <div class="transcript-header-tabs">
        <div class="transcript-notched-control">
          <button class="transcript-tab-btn ${state.activeTranscriptTab === 'original' ? 'active' : ''}" data-tab="original">Original</button>
          <button class="transcript-tab-btn disabled-tab" data-tab="romanized" title="Phase 6">Romanized (Not configured)</button>
          <button class="transcript-tab-btn disabled-tab" data-tab="translation" title="Phase 6">Translation (Not configured)</button>
        </div>
        <span class="badge-tag" style="font-family: var(--font-mono); font-size: 0.72rem;">
          ${segments.length} segments
        </span>
      </div>

      <!-- Action Toolbar -->
      <div class="transcript-action-toolbar">
        <div class="toolbar-group-left">
          <button class="btn-icon-tiny" id="btn-undo-transcript" title="Undo (Cmd+Z)" disabled>↶ Undo</button>
          <button class="btn-icon-tiny" id="btn-redo-transcript" title="Redo (Cmd+Shift+Z)" disabled>↷ Redo</button>
          <button class="btn-icon-tiny" id="btn-toggle-search" title="Search Transcript (Cmd+F)">🔍 Search</button>
        </div>
        <div>
          <button class="btn-icon-tiny" id="btn-export-txt" title="Export as TXT" ${!tr ? 'disabled' : ''}>
            📥 Export TXT
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="transcript-search-bar" id="transcript-search-bar" style="display: ${state.transcriptSearchQuery ? 'flex' : 'none'};">
        <div class="search-input-line">
          <span>🔍</span>
          <input type="text" id="transcript-search-input" placeholder="Search in transcript..." value="${state.transcriptSearchQuery}">
          <button class="btn-icon-tiny" id="btn-close-search">✕</button>
        </div>
        <div class="search-hits-strip" id="search-hits-strip">
          ${state.transcriptSearchHits.map(h => `
            <span class="search-hit-chip" data-seek="${h.start}">
              ${formatTimestampMs(h.start)}: ${h.word}
            </span>
          `).join('')}
        </div>
      </div>

      <!-- Segments Scroll List -->
      <div class="segments-scroll-box" id="segments-container">
        ${segments.length === 0 ? `
          <div style="color: var(--text-muted); text-align: center; margin: auto; padding: 40px 20px;">
            <p>No transcript generated yet.</p>
            <p style="font-size: 0.8rem; margin-top: 6px;">Select model and click <strong>Transcribe Now</strong> to start.</p>
          </div>
        ` : segments.map(seg => renderSegmentItem(seg)).join('')}
      </div>

      <!-- Floating Jump to Current Sentence Button -->
      <div class="jump-to-current-chip" id="jump-to-current-chip" style="display: none;">
        <span>↓ Jump to current</span>
      </div>
    </div>
  `;
}

function renderSegmentItem(seg) {
  const words = seg.words || [];
  const isEditing = seg._isEditing;

  return `
    <div class="segment-item-block ${state.activeSegmentId === seg.id ? 'active-sentence' : ''}" id="seg-block-${seg.id}" data-segment-id="${seg.id}">
      <div class="segment-top-row">
        <span class="segment-time-pill" data-seek="${seg.start}" title="Click to seek">
          ${formatTimestampMs(seg.start)}
        </span>
        <div class="segment-hover-actions">
          <button class="btn-seg-action" data-action="play-seg" data-seek="${seg.start}" title="Play from here">▶</button>
          <button class="btn-seg-action" data-action="edit-seg" data-id="${seg.id}" title="Edit text">✏️ Edit</button>
          <button class="btn-seg-action cut-btn" data-action="cut-seg" data-id="${seg.id}" title="Propose cut (EDL)">✂️ Remove</button>
        </div>
      </div>

      ${isEditing ? `
        <div class="segment-edit-box">
          <textarea class="segment-edit-textarea" id="textarea-seg-${seg.id}">${seg.text}</textarea>
          <div class="edit-actions-row">
            <button class="btn-icon-tiny" data-action="cancel-edit" data-id="${seg.id}">Cancel</button>
            <button class="btn-lime" data-action="save-edit" data-id="${seg.id}" style="padding: 4px 12px; font-size: 0.78rem;">Save</button>
          </div>
        </div>
      ` : `
        <div class="segment-text-flow" data-segment-id="${seg.id}">
          ${words.length > 0 ? words.map(w => {
            const isLowConf = w.confidence !== undefined && w.confidence < 0.70;
            const isActive = state.activeWordId === w.id;
            return `
              <span class="karaoke-word ${isActive ? 'active-word' : ''} ${isLowConf ? 'low-confidence' : ''}" 
                    id="word-${w.id}"
                    data-word-id="${w.id}"
                    data-start="${w.start}"
                    data-end="${w.end}"
                    ${isLowConf ? `data-tooltip="Confidence: ${Math.round(w.confidence * 100)}%"` : ''}
                    title="Click to seek (${w.start}s)">
                ${w.text}
              </span>
            `;
          }).join('') : seg.text}
        </div>
      `}
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Proposed Edits Panel Component
// ----------------------------------------------------------------------------
function renderProposedEditsPanel() {
  const cuts = state.proposedCuts || [];

  return `
    <div class="proposed-edits-panel" id="proposed-edits-panel">
      <div class="proposed-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>✂️</span>
          <span>Proposed Edits (EDL)</span>
          <span class="badge-tag" style="background-color: rgba(239, 68, 68, 0.15); color: #f87171;">
            ${cuts.length} proposed cuts
          </span>
        </div>
        <span style="font-size: 0.75rem; color: #94a3b8;">
          Cuts are non-destructive proposals. Original media files remain untouched.
        </span>
      </div>

      <div class="proposed-cuts-list">
        ${cuts.length === 0 ? `
          <div style="color: var(--text-muted); font-size: 0.8rem; padding: 8px 0;">
            No proposed cuts yet. Hover over any sentence in the transcript and click <strong>✂️ Remove</strong> to propose a cut.
          </div>
        ` : cuts.map(c => `
          <div class="proposed-cut-item">
            <div class="cut-info-left">
              <span class="cut-time-range">${formatTimestampMs(c.start_time)} - ${formatTimestampMs(c.end_time)}</span>
              <span class="cut-snippet">"${c.text || 'Cut segment'}"</span>
              <span class="status-pill ${c.status}">${c.status}</span>
            </div>
            <div class="cut-actions-right">
              ${c.status === 'proposed' ? `
                <button class="btn-icon-tiny" data-action="accept-cut" data-id="${c.id}" style="color: var(--accent-lime);">✓ Accept</button>
                <button class="btn-icon-tiny" data-action="ignore-cut" data-id="${c.id}" style="color: #94a3b8;">✕ Ignore</button>
              ` : `
                <button class="btn-icon-tiny" data-action="reset-cut" data-id="${c.id}">Reset</button>
              `}
              <button class="btn-icon-tiny" data-action="delete-cut" data-id="${c.id}" title="Undo proposal" style="color: #f87171;">Undo</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Timeline Placeholder Card (for Phase 3)
// ----------------------------------------------------------------------------
function renderTimelinePlaceholderCard() {
  const dur = state.selectedMedia?.duration || 0;

  return `
    <div class="timeline-placeholder-card">
      <div class="timeline-card-header">
        <h3 class="timeline-card-title">
          <span>🎞️</span>
          <span>Timeline Studio (Phase 3 Foundation)</span>
        </h3>
        <span style="font-size: 0.75rem; color: #94a3b8;">
          EDL Duration: ${formatDuration(dur)}
        </span>
      </div>
      <div class="timeline-tracks-mock">
        <div class="mock-track-row">
          <span class="track-header-badge">Video 1</span>
          <div class="mock-track-strip">
            ${state.selectedMedia ? `${state.selectedMedia.file_name} [${formatDuration(dur)}]` : 'Main Video Track'}
          </div>
        </div>
        <div class="mock-track-row">
          <span class="track-header-badge">Audio 1</span>
          <div class="mock-track-strip audio-wave">
            Original 16kHz PCM Audio Stream
          </div>
        </div>
        <div class="mock-track-row">
          <span class="track-header-badge">Captions</span>
          <div class="mock-track-strip captions-strip">
            ${state.transcript ? `${state.transcript.segments?.length || 0} transcript caption blocks` : 'No captions generated'}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Event Handlers & Sync
// ============================================================================
function attachEventHandlers() {
  // Top nav
  document.getElementById('nav-btn-home')?.addEventListener('click', () => {
    state.currentView = 'home';
    render();
  });
  document.getElementById('nav-btn-editor')?.addEventListener('click', () => {
    if (!state.selectedProject) {
      showToast('Select a project first');
      return;
    }
    openProjectInEditor(state.selectedProject.id);
  });

  // Home buttons
  document.getElementById('btn-new-project')?.addEventListener('click', showNewProjectModal);
  document.getElementById('btn-import-local-home')?.addEventListener('click', showImportPathModal);
  document.getElementById('btn-quick-import')?.addEventListener('click', showImportModal);

  // Search input
  document.getElementById('project-search-input')?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    filterProjects();
  });

  // Filter tabs
  document.querySelectorAll('.notched-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeFilter = btn.dataset.filter;
      filterProjects();
    });
  });

  // Project item row click
  document.querySelectorAll('.project-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const pid = row.dataset.projectId;
      const p = state.projects.find(x => x.id === pid);
      if (p) {
        state.selectedProject = p;
        render();
      }
    });
  });

  // Detail card buttons
  document.getElementById('btn-open-in-editor')?.addEventListener('click', () => {
    if (state.selectedProject) openProjectInEditor(state.selectedProject.id);
  });
  document.getElementById('btn-duplicate-proj')?.addEventListener('click', handleDuplicateProject);
  document.getElementById('btn-delete-proj')?.addEventListener('click', handleDeleteProject);

  // Editor back button
  document.getElementById('btn-back-to-home')?.addEventListener('click', () => {
    state.currentView = 'home';
    render();
  });

  // Editor video player hooks
  setupVideoPlayer();

  // Transcribe panel hooks
  setupTranscribePanel();

  // Transcript card hooks
  setupTranscriptCard();

  // Proposed cuts actions
  setupProposedCutsHandlers();
}

function setupVideoPlayer() {
  const video = document.getElementById('studio-video');
  if (!video) return;

  video.addEventListener('timeupdate', () => {
    state.currentTime = video.currentTime;
    syncVideoWithTranscript(video.currentTime);
    updateScrubber(video.currentTime, video.duration);
    updateTimecodeHUD(video.currentTime);
  });

  video.addEventListener('loadedmetadata', () => {
    state.duration = video.duration;
    updateScrubber(0, video.duration);
  });

  video.addEventListener('play', () => {
    state.isPlaying = true;
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.textContent = '⏸ Pause';
  });

  video.addEventListener('pause', () => {
    state.isPlaying = false;
    const btn = document.getElementById('btn-play-pause');
    if (btn) btn.textContent = '▶ Play';
  });

  // Play / Pause toggle
  document.getElementById('btn-play-pause')?.addEventListener('click', () => {
    if (video.paused) video.play();
    else video.pause();
  });

  // Frame Stepping
  const fps = state.selectedMedia?.fps || 30.0;
  const frameTime = 1.0 / fps;

  document.getElementById('btn-frame-back')?.addEventListener('click', () => {
    video.pause();
    video.currentTime = Math.max(0, video.currentTime - frameTime);
  });

  document.getElementById('btn-frame-fwd')?.addEventListener('click', () => {
    video.pause();
    video.currentTime = Math.min(video.duration || 0, video.currentTime + frameTime);
  });

  // Scrubber drag
  const scrubber = document.getElementById('video-scrubber');
  if (scrubber) {
    scrubber.addEventListener('input', (e) => {
      const pct = parseFloat(e.target.value);
      if (video.duration) {
        video.currentTime = (pct / 100.0) * video.duration;
      }
    });
  }

  // Playback speed
  document.getElementById('select-playback-speed')?.addEventListener('change', (e) => {
    video.playbackRate = parseFloat(e.target.value);
    state.playbackRate = video.playbackRate;
  });

  // Aspect Overlay
  document.getElementById('select-aspect-overlay')?.addEventListener('change', (e) => {
    state.selectedAspect = e.target.value;
    updateAspectOverlay();
  });

  // Safe Zones
  document.getElementById('select-safe-zone')?.addEventListener('change', (e) => {
    state.selectedSafeZone = e.target.value;
    updateSafeZoneOverlay();
  });

  // Volume & Mute
  document.getElementById('btn-volume-mute')?.addEventListener('click', () => {
    video.muted = !video.muted;
    state.isMuted = video.muted;
    const btn = document.getElementById('btn-volume-mute');
    if (btn) btn.textContent = video.muted ? '🔇' : '🔊';
  });

  document.getElementById('volume-slider')?.addEventListener('input', (e) => {
    video.volume = parseFloat(e.target.value);
    video.muted = false;
  });

  // Fullscreen
  document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
    const vp = document.getElementById('monitor-viewport');
    if (vp) {
      if (!document.fullscreenElement) vp.requestFullscreen();
      else document.exitFullscreen();
    }
  });

  // Stream toggle (Original vs Proxy)
  document.querySelectorAll('.stream-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.stream;
      if (mode === 'proxy' && state.selectedMedia?.proxy_status !== 'ready') {
        showToast('Proxy is not yet generated');
        return;
      }
      state.streamMode = mode;
      const cur = video.currentTime;
      video.src = mode === 'proxy' 
        ? `/api/media/${state.selectedMedia.id}/proxy/stream`
        : `/api/media/${state.selectedMedia.id}/stream`;
      video.currentTime = cur;
      render();
    });
  });
}

function updateScrubber(current, duration) {
  const curSpan = document.getElementById('scrub-current-time');
  const totalSpan = document.getElementById('scrub-total-duration');
  const slider = document.getElementById('video-scrubber');

  if (curSpan) curSpan.textContent = formatDuration(current);
  if (totalSpan && duration) totalSpan.textContent = formatDuration(duration);
  if (slider && duration > 0) {
    slider.value = (current / duration) * 100.0;
  }
}

function updateTimecodeHUD(current) {
  const hud = document.getElementById('floating-timecode');
  if (hud) {
    const fps = state.selectedMedia?.fps || 30.0;
    hud.textContent = secondsToTimecode(current, fps);
  }
}

function updateAspectOverlay() {
  const box = document.getElementById('aspect-overlay-box');
  if (!box) return;
  if (state.selectedAspect === 'original') {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  // Aspect proportions
  if (state.selectedAspect === '9:16') {
    box.style.width = '292px';
    box.style.height = '520px';
  } else if (state.selectedAspect === '1:1') {
    box.style.width = '500px';
    box.style.height = '500px';
  } else if (state.selectedAspect === '4:5') {
    box.style.width = '416px';
    box.style.height = '520px';
  } else {
    box.style.width = '100%';
    box.style.height = '100%';
  }
}

function updateSafeZoneOverlay() {
  const box = document.getElementById('safe-zone-box');
  if (!box) return;
  if (state.selectedSafeZone === 'none') {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  box.style.display = 'block';
  if (state.selectedSafeZone === 'instagram') {
    box.innerHTML = `
      <div class="safe-zone-instagram">
        <span class="safe-zone-label">Instagram Reels UI Safe Area</span>
      </div>
    `;
  } else if (state.selectedSafeZone === 'tiktok') {
    box.innerHTML = `
      <div class="safe-zone-instagram" style="bottom: 24%; right: 16%;">
        <span class="safe-zone-label">TikTok UI Safe Area</span>
      </div>
    `;
  } else if (state.selectedSafeZone === 'youtube') {
    box.innerHTML = `
      <div class="safe-zone-instagram" style="top: 10%; bottom: 18%;">
        <span class="safe-zone-label">YouTube Shorts Safe Area</span>
      </div>
    `;
  }
}

// ----------------------------------------------------------------------------
// Video <-> Transcript Bi-directional Synchronization
// ----------------------------------------------------------------------------
function syncVideoWithTranscript(time) {
  if (!state.transcript || !state.transcript.segments) return;

  let matchedSeg = null;
  let matchedWord = null;

  for (const seg of state.transcript.segments) {
    if (time >= seg.start && time <= seg.end) {
      matchedSeg = seg;
      if (seg.words) {
        for (const w of seg.words) {
          if (time >= w.start && time <= w.end) {
            matchedWord = w;
            break;
          }
        }
      }
      break;
    }
  }

  // Highlight segment
  if (matchedSeg && matchedSeg.id !== state.activeSegmentId) {
    state.activeSegmentId = matchedSeg.id;
    document.querySelectorAll('.segment-item-block').forEach(el => el.classList.remove('active-sentence'));
    const activeEl = document.getElementById(`seg-block-${matchedSeg.id}`);
    if (activeEl) {
      activeEl.classList.add('active-sentence');
      if (!state.isUserScrollingTranscript) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // Highlight karaoke active word in vibrant lime!
  if (matchedWord && matchedWord.id !== state.activeWordId) {
    state.activeWordId = matchedWord.id;
    document.querySelectorAll('.karaoke-word').forEach(el => el.classList.remove('active-word'));
    const wordEl = document.getElementById(`word-${matchedWord.id}`);
    if (wordEl) {
      wordEl.classList.add('active-word');
    }
  }
}

// ----------------------------------------------------------------------------
// Transcribe Panel Hooks
// ----------------------------------------------------------------------------
function setupTranscribePanel() {
  document.getElementById('select-whisper-model')?.addEventListener('change', (e) => {
    state.selectedModel = e.target.value;
  });

  document.getElementById('select-whisper-language')?.addEventListener('change', (e) => {
    state.selectedLanguage = e.target.value;
  });

  document.getElementById('btn-start-transcribe')?.addEventListener('click', async () => {
    if (!state.selectedMedia) {
      showToast('Select a media clip to transcribe');
      return;
    }

    try {
      const stepper = document.getElementById('job-progress-stepper');
      if (stepper) stepper.style.display = 'flex';
      
      const res = await startTranscription(
        state.selectedMedia.id,
        state.selectedModel,
        state.selectedLanguage
      );
      showToast(`Transcription started (${state.selectedModel})`);
      state.activeJob = {
        job_id: res.job_id,
        status: 'queued',
        progress: 0,
        step: 'extracting_audio',
        message: 'Job queued...'
      };
    } catch (e) {
      showToast(`Failed: ${e.message}`);
    }
  });

  document.getElementById('btn-cancel-job')?.addEventListener('click', async () => {
    if (state.activeJob && state.activeJob.job_id) {
      try {
        await cancelJob(state.activeJob.job_id);
        showToast('Transcription job cancelled');
      } catch (e) {
        showToast(`Cancel failed: ${e.message}`);
      }
    }
  });
}

function updateJobProgressUI(job) {
  const stepper = document.getElementById('job-progress-stepper');
  if (!stepper) return;

  if (job.status === 'running') {
    stepper.style.display = 'flex';
  } else if (job.status === 'completed' || job.status === 'cancelled') {
    setTimeout(() => {
      stepper.style.display = 'none';
    }, 2000);
  }

  const msg = document.getElementById('stepper-status-msg');
  const pct = document.getElementById('stepper-pct');
  const fill = document.getElementById('stepper-progress-fill');

  if (msg) msg.textContent = job.message || 'Processing...';
  if (pct) pct.textContent = `${Math.round(job.progress || 0)}%`;
  if (fill) fill.style.width = `${job.progress || 0}%`;

  const s1 = document.getElementById('step-extract');
  const s2 = document.getElementById('step-model');
  const s3 = document.getElementById('step-transcribe');

  if (job.step === 'extracting_audio') {
    s1?.classList.add('active');
    s2?.classList.remove('active');
    s3?.classList.remove('active');
  } else if (job.step === 'loading_model') {
    s1?.classList.add('done');
    s2?.classList.add('active');
    s3?.classList.remove('active');
  } else if (job.step === 'transcribing') {
    s1?.classList.add('done');
    s2?.classList.add('done');
    s3?.classList.add('active');
  }
}

// ----------------------------------------------------------------------------
// Transcript Card Hooks
// ----------------------------------------------------------------------------
function setupTranscriptCard() {
  const container = document.getElementById('segments-container');
  if (container) {
    // Detect manual scrolling to pause auto-scroll
    container.addEventListener('scroll', () => {
      state.isUserScrollingTranscript = true;
      const chip = document.getElementById('jump-to-current-chip');
      if (chip) chip.style.display = 'flex';

      if (state.transcriptScrollTimeout) clearTimeout(state.transcriptScrollTimeout);
      state.transcriptScrollTimeout = setTimeout(() => {
        // Still keep chip visible until user clicks it or scrolls back
      }, 3000);
    });
  }

  // Jump to current chip
  document.getElementById('jump-to-current-chip')?.addEventListener('click', () => {
    state.isUserScrollingTranscript = false;
    const chip = document.getElementById('jump-to-current-chip');
    if (chip) chip.style.display = 'none';

    if (state.activeSegmentId) {
      const activeEl = document.getElementById(`seg-block-${state.activeSegmentId}`);
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // Undo / Redo buttons
  document.getElementById('btn-undo-transcript')?.addEventListener('click', undoLastCommand);
  document.getElementById('btn-redo-transcript')?.addEventListener('click', redoLastCommand);
  updateUndoRedoButtons();

  // Search Toggle
  document.getElementById('btn-toggle-search')?.addEventListener('click', () => {
    const sbar = document.getElementById('transcript-search-bar');
    if (sbar) {
      sbar.style.display = sbar.style.display === 'none' ? 'flex' : 'none';
      if (sbar.style.display === 'flex') {
        document.getElementById('transcript-search-input')?.focus();
      }
    }
  });

  document.getElementById('btn-close-search')?.addEventListener('click', () => {
    const sbar = document.getElementById('transcript-search-bar');
    if (sbar) sbar.style.display = 'none';
    state.transcriptSearchQuery = '';
    state.transcriptSearchHits = [];
  });

  // Search input with debounce
  let searchTimer = null;
  document.getElementById('transcript-search-input')?.addEventListener('input', (e) => {
    const q = e.target.value;
    state.transcriptSearchQuery = q;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      if (!q.trim() || !state.selectedMedia) {
        state.transcriptSearchHits = [];
        updateSearchHitsUI();
        return;
      }
      try {
        const res = await searchTranscript(state.selectedMedia.id, q);
        const hits = [];
        res.matches.forEach(m => {
          m.matched_words.forEach(w => {
            hits.push({ start: w.start, word: w.text });
          });
        });
        state.transcriptSearchHits = hits;
        updateSearchHitsUI();
      } catch (err) {
        console.warn('Search error:', err);
      }
    }, 250);
  });

  // Export TXT
  document.getElementById('btn-export-txt')?.addEventListener('click', () => {
    if (state.selectedMedia) {
      window.open(getTranscriptExportUrl(state.selectedMedia.id), '_blank');
      showToast('Exporting transcript as TXT...');
    }
  });

  // Delegation on segments container
  container?.addEventListener('click', (e) => {
    // 1. Click word to seek
    const wordEl = e.target.closest('.karaoke-word');
    if (wordEl) {
      const seekTime = parseFloat(wordEl.dataset.start);
      seekVideoTo(seekTime);
      return;
    }

    // 2. Click timestamp to seek
    const timePill = e.target.closest('.segment-time-pill');
    if (timePill) {
      const seekTime = parseFloat(timePill.dataset.seek);
      seekVideoTo(seekTime);
      return;
    }

    // 3. Play from here button
    const playBtn = e.target.closest('[data-action="play-seg"]');
    if (playBtn) {
      const seekTime = parseFloat(playBtn.dataset.seek);
      seekVideoTo(seekTime, true);
      return;
    }

    // 4. Edit sentence button
    const editBtn = e.target.closest('[data-action="edit-seg"]');
    if (editBtn) {
      const segId = editBtn.dataset.id;
      toggleEditSegment(segId, true);
      return;
    }

    // 5. Cancel edit
    const cancelBtn = e.target.closest('[data-action="cancel-edit"]');
    if (cancelBtn) {
      const segId = cancelBtn.dataset.id;
      toggleEditSegment(segId, false);
      return;
    }

    // 6. Save edit
    const saveBtn = e.target.closest('[data-action="save-edit"]');
    if (saveBtn) {
      const segId = saveBtn.dataset.id;
      const ta = document.getElementById(`textarea-seg-${segId}`);
      if (ta && state.transcript) {
        const seg = state.transcript.segments.find(s => s.id === segId);
        if (seg) {
          const oldText = seg.text;
          const newText = ta.value.trim();
          if (oldText !== newText) {
            executeCommand(new EditSegmentCommand(state.transcript.id, segId, oldText, newText));
          } else {
            toggleEditSegment(segId, false);
          }
        }
      }
      return;
    }

    // 7. Cut / Remove from video
    const cutBtn = e.target.closest('[data-action="cut-seg"]');
    if (cutBtn) {
      const segId = cutBtn.dataset.id;
      proposeCutForSegment(segId);
      return;
    }
  });
}

function updateSearchHitsUI() {
  const strip = document.getElementById('search-hits-strip');
  if (!strip) return;
  strip.innerHTML = state.transcriptSearchHits.map(h => `
    <span class="search-hit-chip" data-seek="${h.start}">
      ${formatTimestampMs(h.start)}: ${h.word}
    </span>
  `).join('');

  strip.querySelectorAll('.search-hit-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const seek = parseFloat(chip.dataset.seek);
      seekVideoTo(seek);
    });
  });
}

function toggleEditSegment(segId, isEditing) {
  if (!state.transcript || !state.transcript.segments) return;
  const seg = state.transcript.segments.find(s => s.id === segId);
  if (seg) {
    seg._isEditing = isEditing;
    renderTranscriptSegments();
  }
}

function renderTranscriptSegments() {
  const container = document.getElementById('segments-container');
  if (!container || !state.transcript) return;
  container.innerHTML = state.transcript.segments.map(s => renderSegmentItem(s)).join('');
}

function seekVideoTo(seconds, autoPlay = false) {
  const video = document.getElementById('studio-video');
  if (video) {
    video.currentTime = Math.max(0, seconds);
    if (autoPlay) video.play();
  }
}

// ----------------------------------------------------------------------------
// Proposed Cuts (EDL) Handlers
// ----------------------------------------------------------------------------
function setupProposedCutsHandlers() {
  const panel = document.getElementById('proposed-edits-panel');
  if (!panel) return;

  panel.addEventListener('click', async (e) => {
    const acceptBtn = e.target.closest('[data-action="accept-cut"]');
    if (acceptBtn) {
      await updateProposedCut(acceptBtn.dataset.id, 'accepted');
      await reloadProposedCuts();
      showToast('Cut accepted');
      return;
    }

    const ignoreBtn = e.target.closest('[data-action="ignore-cut"]');
    if (ignoreBtn) {
      await updateProposedCut(ignoreBtn.dataset.id, 'ignored');
      await reloadProposedCuts();
      showToast('Cut ignored');
      return;
    }

    const resetBtn = e.target.closest('[data-action="reset-cut"]');
    if (resetBtn) {
      await updateProposedCut(resetBtn.dataset.id, 'proposed');
      await reloadProposedCuts();
      return;
    }

    const delBtn = e.target.closest('[data-action="delete-cut"]');
    if (delBtn) {
      await deleteProposedCut(delBtn.dataset.id);
      await reloadProposedCuts();
      showToast('Cut proposal removed');
      return;
    }
  });

  document.getElementById('btn-toggle-proposed-cuts')?.addEventListener('click', () => {
    panel.scrollIntoView({ behavior: 'smooth' });
  });
}

async function proposeCutForSegment(segId) {
  if (!state.transcript || !state.selectedProject || !state.selectedMedia) return;
  const seg = state.transcript.segments.find(s => s.id === segId);
  if (!seg) return;

  try {
    await createProposedCut(state.selectedProject.id, {
      media_id: state.selectedMedia.id,
      segment_id: seg.id,
      start_time: seg.start,
      end_time: seg.end,
      text: seg.text
    });
    await reloadProposedCuts();
    showToast(`Proposed cut created: [${formatTimestampMs(seg.start)} - ${formatTimestampMs(seg.end)}]`);
  } catch (err) {
    showToast(`Failed to propose cut: ${err.message}`);
  }
}

async function reloadProposedCuts() {
  if (!state.selectedProject) return;
  state.proposedCuts = await fetchProposedCuts(state.selectedProject.id);
  const panel = document.getElementById('proposed-edits-panel');
  if (panel) {
    panel.outerHTML = renderProposedEditsPanel();
    setupProposedCutsHandlers();
  }
}

async function reloadCurrentTranscript() {
  if (!state.selectedMedia) return;
  try {
    const tr = await fetchTranscript(state.selectedMedia.id);
    state.transcript = tr;
    renderTranscriptSegments();
  } catch (err) {
    console.warn('Reload transcript error:', err);
  }
}

// ============================================================================
// Navigation & Project Loading
// ============================================================================
async function openProjectInEditor(projectId) {
  try {
    const projDetails = await fetchProject(projectId);
    state.selectedProject = projDetails;
    state.activeProjectDetails = projDetails;

    if (projDetails.media && projDetails.media.length > 0) {
      state.selectedMedia = projDetails.media[0];
    } else {
      state.selectedMedia = null;
    }

    state.currentView = 'editor';

    // Fetch transcript if media exists
    if (state.selectedMedia) {
      const tr = await fetchTranscript(state.selectedMedia.id);
      state.transcript = tr;
    } else {
      state.transcript = null;
    }

    // Fetch proposed cuts
    state.proposedCuts = await fetchProposedCuts(projectId);

    state.undoStack = [];
    state.redoStack = [];

    render();
  } catch (err) {
    showToast(`Failed to open project: ${err.message}`);
  }
}

async function refreshHomeData() {
  try {
    const [stats, projs] = await Promise.all([
      fetchStats(),
      fetchProjects(state.activeFilter, state.searchQuery)
    ]);
    state.stats = stats;
    state.projects = projs;
    if (state.selectedProject) {
      state.selectedProject = projs.find(p => p.id === state.selectedProject.id) || projs[0];
    }
    render();
  } catch (err) {
    console.warn('Refresh error:', err);
  }
}

async function filterProjects() {
  try {
    const projs = await fetchProjects(state.activeFilter, state.searchQuery);
    state.projects = projs;
    const list = document.querySelector('.project-list-items');
    if (list) {
      list.innerHTML = projs.length === 0 ? `
        <div class="empty-projects-state"><p>No projects match your filter.</p></div>
      ` : projs.map(p => `
        <div class="project-item-row ${state.selectedProject && state.selectedProject.id === p.id ? 'selected' : ''}" data-project-id="${p.id}">
          <div class="item-left-group">
            <div class="item-thumbnail">
              ${p.thumbnail_path ? `<img src="${p.thumbnail_path}" alt="Thumb" />` : '🎬'}
            </div>
            <div class="item-text-info">
              <span class="item-id"># ${p.id}</span>
              <span class="item-name" style="font-size: 0.82rem; font-weight: 600;">${p.name}</span>
              <span class="item-date">${p.aspect_ratio || '16:9'} • ${p.fps || 30} fps</span>
            </div>
          </div>
          <div class="item-right-group">
            <span class="status-pill ${p.status || 'draft'}">${p.status || 'draft'}</span>
            <span class="item-amount">${formatDuration(p.total_duration || p.duration || 0)}</span>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('.project-item-row').forEach(row => {
        row.addEventListener('click', () => {
          const pid = row.dataset.projectId;
          state.selectedProject = state.projects.find(x => x.id === pid);
          render();
        });
      });
    }
  } catch (err) {
    console.warn(err);
  }
}

async function handleDuplicateProject() {
  if (!state.selectedProject) return;
  try {
    const dup = await duplicateProject(state.selectedProject.id);
    showToast(`Project duplicated as #${dup.id}`);
    await refreshHomeData();
  } catch (err) {
    showToast(`Duplicate failed: ${err.message}`);
  }
}

async function handleDeleteProject() {
  if (!state.selectedProject) return;
  if (!confirm(`Are you sure you want to delete Project #${state.selectedProject.id}? This will remove all associated timeline and proxy assets.`)) {
    return;
  }
  try {
    await deleteProject(state.selectedProject.id);
    showToast('Project deleted');
    state.selectedProject = null;
    await refreshHomeData();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`);
  }
}

// ============================================================================
// Modals & Dialogs
// ============================================================================
function showNewProjectModal() {
  const modalHtml = `
    <div class="modal-overlay" id="new-proj-modal">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">+ Create New Project</h3>
          <button class="btn-icon-tiny" id="modal-close-btn">✕</button>
        </div>
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" class="form-input" id="inp-proj-name" placeholder="e.g. Social Reel - Podcast Highlights">
        </div>
        <div class="form-group">
          <label class="form-label">Aspect Ratio</label>
          <select class="custom-select" id="inp-proj-aspect">
            <option value="16:9">16:9 (Landscape / YouTube)</option>
            <option value="9:16" selected>9:16 (Vertical / Reels / TikTok)</option>
            <option value="1:1">1:1 (Square)</option>
            <option value="4:5">4:5 (Portrait)</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn-dark-pill" id="modal-cancel-btn">Cancel</button>
          <button class="btn-lime" id="modal-submit-create">Create Project</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('modal-close-btn')?.addEventListener('click', removeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', removeModal);
  document.getElementById('modal-submit-create')?.addEventListener('click', async () => {
    const name = document.getElementById('inp-proj-name')?.value.trim();
    const aspect = document.getElementById('inp-proj-aspect')?.value;
    if (!name) {
      showToast('Enter a project name');
      return;
    }
    try {
      const p = await createProject({ name, aspect_ratio: aspect });
      removeModal();
      showToast(`Created project #${p.id}`);
      state.selectedProject = p;
      await refreshHomeData();
      openProjectInEditor(p.id);
    } catch (e) {
      showToast(`Error: ${e.message}`);
    }
  });
}

function showImportPathModal() {
  if (!state.selectedProject) {
    showToast('Select or create a project first');
    return;
  }

  const modalHtml = `
    <div class="modal-overlay" id="import-path-modal">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">📁 Import Local File by Path</h3>
          <button class="btn-icon-tiny" id="modal-close-btn">✕</button>
        </div>
        <p style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 14px;">
          Direct filesystem import. Supported: MP4, MOV, MKV, AVI, WEBM, MP3, WAV, M4A, AAC.
        </p>
        <div class="form-group">
          <label class="form-label">Absolute File Path on Disk</label>
          <input type="text" class="form-input" id="inp-local-path" placeholder="/Users/.../video.mp4">
        </div>
        <div class="modal-footer">
          <button class="btn-dark-pill" id="modal-cancel-btn">Cancel</button>
          <button class="btn-lime" id="modal-submit-import">Import File</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('modal-close-btn')?.addEventListener('click', removeModal);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', removeModal);
  document.getElementById('modal-submit-import')?.addEventListener('click', async () => {
    const path = document.getElementById('inp-local-path')?.value.trim();
    if (!path) return;
    try {
      showToast('Importing and probing file...');
      const media = await importLocalPath(state.selectedProject.id, path);
      removeModal();
      showToast(`Imported ${media.file_name} (${media.width}x${media.height})`);
      await openProjectInEditor(state.selectedProject.id);
    } catch (e) {
      showToast(`Import error: ${e.message}`);
    }
  });
}

function showImportModal() {
  showImportPathModal();
}

function removeModal() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
}

// ----------------------------------------------------------------------------
// Keyboard Shortcuts
// ----------------------------------------------------------------------------
function handleGlobalKeydown(e) {
  // Space: Play/Pause video
  if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    const video = document.getElementById('studio-video');
    if (video) {
      if (video.paused) video.play();
      else video.pause();
    }
    return;
  }

  // Left Arrow: -1 frame
  if (e.code === 'ArrowLeft' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    const video = document.getElementById('studio-video');
    if (video) {
      video.pause();
      const fps = state.selectedMedia?.fps || 30.0;
      video.currentTime = Math.max(0, video.currentTime - (1.0 / fps));
    }
    return;
  }

  // Right Arrow: +1 frame
  if (e.code === 'ArrowRight' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
    const video = document.getElementById('studio-video');
    if (video) {
      video.pause();
      const fps = state.selectedMedia?.fps || 30.0;
      video.currentTime = Math.min(video.duration || 0, video.currentTime + (1.0 / fps));
    }
    return;
  }

  // Cmd+F or Ctrl+F: Transcript Search
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    if (state.currentView === 'editor') {
      e.preventDefault();
      const sbar = document.getElementById('transcript-search-bar');
      if (sbar) {
        sbar.style.display = 'flex';
        document.getElementById('transcript-search-input')?.focus();
      }
    }
    return;
  }

  // Cmd+Z: Undo
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
    if (state.currentView === 'editor') {
      e.preventDefault();
      undoLastCommand();
    }
    return;
  }

  // Cmd+Shift+Z or Cmd+Y: Redo
  if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')) {
    if (state.currentView === 'editor') {
      e.preventDefault();
      redoLastCommand();
    }
    return;
  }
}

// ----------------------------------------------------------------------------
// Toast Notification Utility
// ----------------------------------------------------------------------------
function showToast(msg) {
  const root = document.getElementById('toast-root') || document.body;
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => {
    t.remove();
  }, 3500);
}

// Start application
window.addEventListener('DOMContentLoaded', initApp);
