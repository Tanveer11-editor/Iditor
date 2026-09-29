(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))i(n);new MutationObserver(n=>{for(const o of n)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function a(n){const o={};return n.integrity&&(o.integrity=n.integrity),n.referrerPolicy&&(o.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?o.credentials="include":n.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(n){if(n.ep)return;n.ep=!0;const o=a(n);fetch(n.href,o)}})();const f="/api";async function tt(){const t=await fetch(`${f}/system/capabilities`);if(!t.ok)throw new Error("Failed to fetch capabilities");return t.json()}async function V(){const t=await fetch(`${f}/system/stats`);if(!t.ok)throw new Error("Failed to fetch system stats");return t.json()}async function A(t="",s=""){const a=new URLSearchParams;t&&t!=="all"&&a.append("status",t),s&&a.append("q",s);const i=await fetch(`${f}/projects?${a.toString()}`);if(!i.ok)throw new Error("Failed to fetch projects");return i.json()}async function et(t){const s=await fetch(`${f}/projects`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!s.ok)throw new Error("Failed to create project");return s.json()}async function st(t){const s=await fetch(`${f}/projects/${t}`);if(!s.ok)throw new Error("Failed to load project details");return s.json()}async function at(t){const s=await fetch(`${f}/projects/${t}/duplicate`,{method:"POST"});if(!s.ok)throw new Error("Failed to duplicate project");return s.json()}async function nt(t){const s=await fetch(`${f}/projects/${t}`,{method:"DELETE"});if(!s.ok)throw new Error("Failed to delete project");return s.json()}async function it(t,s){const a=await fetch(`${f}/media/import-path`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project_id:t,file_path:s})});if(!a.ok){const i=await a.json().catch(()=>({}));throw new Error(i.detail||"Failed to import local file")}return a.json()}async function ot(t,s="small",a="auto"){const i=await fetch(`${f}/transcribe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({media_id:t,model:s,language:a})});if(!i.ok){const n=await i.json().catch(()=>({}));throw new Error(n.detail||"Failed to start transcription")}return i.json()}async function q(t){const s=await fetch(`${f}/transcripts/${t}`);if(!s.ok){if(s.status===404)return null;throw new Error("Failed to fetch transcript")}return s.json()}async function D(t,s,a){const i=await fetch(`${f}/transcripts/${t}/segments/${s}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:a})});if(!i.ok){const n=await i.json().catch(()=>({}));throw new Error(n.detail||"Failed to update segment")}return i.json()}async function rt(t,s){const a=await fetch(`${f}/transcripts/${t}/search?q=${encodeURIComponent(s)}`);if(!a.ok)throw new Error("Failed to search transcript");return a.json()}async function ct(t){const s=await fetch(`${f}/jobs/${t}/cancel`,{method:"POST"});if(!s.ok)throw new Error("Failed to cancel job");return s.json()}async function W(t){const s=await fetch(`${f}/projects/${t}/cuts`);if(!s.ok)throw new Error("Failed to load proposed cuts");return s.json()}async function dt(t,s){const a=await fetch(`${f}/projects/${t}/cuts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!a.ok)throw new Error("Failed to create proposed cut");return a.json()}async function C(t,s){const a=await fetch(`${f}/cuts/${t}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:s})});if(!a.ok)throw new Error("Failed to update cut status");return a.json()}async function lt(t){const s=await fetch(`${f}/cuts/${t}`,{method:"DELETE"});if(!s.ok)throw new Error("Failed to delete proposed cut");return s.json()}function pt(t){return`${f}/transcripts/${t}/export`}class ut{constructor(){this.socket=null,this.listeners=new Set,this.reconnectTimer=null,this.isConnected=!1}connect(){if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;const a=`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/ws/jobs`;try{this.socket=new WebSocket(a),this.socket.onopen=()=>{this.isConnected=!0,this._notifyListeners({type:"ws_status",status:"connected"}),this.pingInterval=setInterval(()=>{this.socket&&this.socket.readyState===WebSocket.OPEN&&this.socket.send("ping")},15e3)},this.socket.onmessage=i=>{try{if(i.data==="pong")return;const n=JSON.parse(i.data);this._notifyListeners(n)}catch(n){console.warn("[WS Parse Error]",n)}},this.socket.onclose=()=>{this.isConnected=!1,clearInterval(this.pingInterval),this._notifyListeners({type:"ws_status",status:"disconnected"}),this._scheduleReconnect()},this.socket.onerror=i=>{this.isConnected=!1,this.socket.close()}}catch{this._scheduleReconnect()}}_scheduleReconnect(){this.reconnectTimer&&clearTimeout(this.reconnectTimer),this.reconnectTimer=setTimeout(()=>{this.connect()},3e3)}subscribe(s){return this.listeners.add(s),()=>this.listeners.delete(s)}_notifyListeners(s){this.listeners.forEach(a=>{try{a(s)}catch(i){console.error("[WS Listener Callback Error]",i)}})}}const H=new ut;function mt(t,s=30){(isNaN(t)||t<0)&&(t=0);const a=s>0?s:30,n=Math.floor(t*a)%Math.round(a),o=Math.floor(t),r=o%60,p=Math.floor(o/60)%60,m=Math.floor(o/3600),c=u=>String(u).padStart(2,"0");return`${c(m)}:${c(p)}:${c(r)}:${c(n)}`}function E(t){if(isNaN(t)||t<=0)return"00:00";const s=Math.floor(t/60),a=Math.floor(t%60);return`${String(s).padStart(2,"0")}:${String(a).padStart(2,"0")}`}function $(t){(isNaN(t)||t<0)&&(t=0);const s=Math.floor(t/60),a=t%60,i=Math.floor(a),n=Math.floor((a-i)*1e3);return`${String(s).padStart(2,"0")}:${String(i).padStart(2,"0")}.${String(n).padStart(3,"0")}`}const e={currentView:"home",projects:[],selectedProject:null,activeProjectDetails:null,selectedMedia:null,activeFilter:"all",searchQuery:"",stats:null,capabilities:null,transcript:null,activeSegmentId:null,activeWordId:null,isUserScrollingTranscript:!1,transcriptScrollTimeout:null,transcriptSearchQuery:"",transcriptSearchHits:[],activeTranscriptTab:"original",proposedCuts:[],currentTime:0,duration:0,isPlaying:!1,playbackRate:1,isMuted:!1,volume:1,selectedAspect:"original",selectedSafeZone:"none",streamMode:"source",selectedModel:"small",selectedLanguage:"auto",activeJob:null,activeJobsList:[],undoStack:[],redoStack:[]};class vt{constructor(s,a,i,n){this.transcriptId=s,this.segmentId=a,this.oldText=i,this.newText=n}async execute(){return await D(this.transcriptId,this.segmentId,this.newText)}async undo(){return await D(this.transcriptId,this.segmentId,this.oldText)}}async function ft(t){try{const s=await t.execute();return e.undoStack.push(t),e.redoStack=[],await B(),L(),d("Edit applied"),s}catch(s){d(`Edit failed: ${s.message}`)}}async function K(){if(e.undoStack.length===0)return;const t=e.undoStack.pop();try{await t.undo(),e.redoStack.push(t),await B(),L(),d("Undo successful")}catch(s){d(`Undo failed: ${s.message}`)}}async function Q(){if(e.redoStack.length===0)return;const t=e.redoStack.pop();try{await t.execute(),e.undoStack.push(t),await B(),L(),d("Redo successful")}catch(s){d(`Redo failed: ${s.message}`)}}function L(){const t=document.getElementById("btn-undo-transcript"),s=document.getElementById("btn-redo-transcript");t&&(t.disabled=e.undoStack.length===0),s&&(s.disabled=e.redoStack.length===0)}async function bt(){H.connect(),H.subscribe(gt),window.addEventListener("keydown",Ht);try{const[t,s,a]=await Promise.all([tt(),V(),A("all")]);e.capabilities=t,e.stats=s,e.projects=a,a.length>0&&(e.selectedProject=a[0])}catch(t){console.warn("Initial load error:",t)}w()}function gt(t){if(!(!t||!t.type)){if(t.type==="job_queued"||t.type==="job_progress"){e.activeJob=t;const s=e.activeJobsList.find(a=>a.job_id===t.job_id);s?Object.assign(s,t):e.activeJobsList.unshift(t),J(t)}t.type==="transcript_segment"&&e.selectedMedia&&t.media_id===e.selectedMedia.id&&ht(t.segment),t.type==="job_completed"&&(e.activeJob&&e.activeJob.job_id===t.job_id&&(e.activeJob.status="completed",e.activeJob.progress=100),d(t.message||"Job completed"),t.job_type==="transcription"&&B(),e.currentView==="home"&&M()),t.type==="job_failed"&&(d(`Error: ${t.message||"Job failed"}`),J(t))}}function ht(t){if(!e.transcript){e.transcript={segments:[t],words:t.words||[]},I();return}if(!e.transcript.segments.some(a=>a.id===t.id)){e.transcript.segments.push(t),t.words&&(e.transcript.words=e.transcript.words.concat(t.words)),I();const a=document.getElementById("segments-container");a&&!e.isUserScrollingTranscript&&(a.scrollTop=a.scrollHeight)}}function w(){const t=document.getElementById("app");t&&(t.innerHTML=`
    <div class="studio-canvas">
      ${yt()}
      ${e.currentView==="home"?wt():$t()}
      <footer class="privacy-footer-banner">
        🔒 <span>Your media stays on this computer. Local AI & offline processing.</span>
      </footer>
    </div>
    <div id="toast-root" class="toast-container"></div>
  `,Tt())}function yt(){var a,i;const s=((a=e.capabilities)==null?void 0:a.apple_silicon)?"VideoToolbox (HW) / CPU int8":"CPU Software";return`
    <header class="top-navbar">
      <div class="brand-section">
        <span class="brand-icon">✦</span>
        <span>TANEDIT AI</span>
      </div>

      <nav class="pill-nav-container">
        <button class="nav-pill ${e.currentView==="home"?"active":""}" id="nav-btn-home">
          <span class="pill-dot"></span>
          <span>⚡ Projects</span>
        </button>
        <button class="nav-pill ${e.currentView==="editor"?"active":""}" id="nav-btn-editor">
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
        <div class="badge-tag" title="${((i=e.capabilities)==null?void 0:i.whisper_note)||"Hardware Engine"}" style="background-color: #161b24; color: var(--accent-lime); border: 1px solid var(--border-dark); font-family: var(--font-mono); font-size: 0.72rem; padding: 6px 10px;">
          ⚡ ${s}
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
  `}function wt(){const t=e.stats||{total_footage_formatted:"0h 0m",time_saved_formatted:"0m",silence_removed_formatted:"0m",total_projects:0,draft_projects:0,exported_projects:0},s=e.selectedProject;return`
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
              <span class="stat-value">${t.total_footage_formatted}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Time saved (AI)</span>
              <span class="stat-value" style="color: var(--accent-lime);">${t.time_saved_formatted}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Silence removed</span>
              <span class="stat-value">${t.silence_removed_formatted}</span>
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
        ${Et()}
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
            <input type="text" id="project-search-input" placeholder="Search projects..." value="${e.searchQuery}">
          </div>
        </div>

        <div class="notched-tabs-row">
          <div class="notched-segmented-control">
            <button class="notched-tab-btn ${e.activeFilter==="all"?"active":""}" data-filter="all">
              <span>All Projects</span>
              <span class="tab-counter">${t.total_projects}</span>
            </button>
            <button class="notched-tab-btn ${e.activeFilter==="draft"?"active":""}" data-filter="draft">
              <span>Draft</span>
              <span class="tab-counter">${t.draft_projects}</span>
            </button>
            <button class="notched-tab-btn ${e.activeFilter==="exported"?"active":""}" data-filter="exported">
              <span>Exported</span>
              <span class="tab-counter">${t.exported_projects}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Centerpiece: White List Panel with Embedded Dark Detail Card -->
      <div class="white-projects-panel">
        <div class="panel-list-section">
          <h2 class="panel-list-header">Projects Library</h2>
          <div class="project-list-items">
            ${e.projects.length===0?`
              <div class="empty-projects-state">
                <p>No projects found. Click <strong>+ New Project</strong> to get started.</p>
              </div>
            `:e.projects.map(a=>`
              <div class="project-item-row ${s&&s.id===a.id?"selected":""}" data-project-id="${a.id}">
                <div class="item-left-group">
                  <div class="item-thumbnail">
                    ${a.thumbnail_path?`<img src="${a.thumbnail_path}" alt="Thumb" />`:"🎬"}
                  </div>
                  <div class="item-text-info">
                    <span class="item-id"># ${a.id}</span>
                    <span class="item-name" style="font-size: 0.82rem; font-weight: 600;">${a.name}</span>
                    <span class="item-date">${a.aspect_ratio||"16:9"} • ${a.fps||30} fps</span>
                  </div>
                </div>
                <div class="item-right-group">
                  <span class="status-pill ${a.status||"draft"}">${a.status||"draft"}</span>
                  <span class="item-amount">${E(a.total_duration||a.duration||0)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Embedded Dark Detail Card -->
        <div class="dark-detail-card">
          ${s?`
            <div>
              <div class="detail-card-header">
                <div class="detail-meta-left">
                  <span class="detail-subheading">Project details</span>
                  <div class="detail-code-row">
                    <span class="detail-code-title"># ${s.id}</span>
                    <span class="status-pill ${s.status||"draft"}">${s.status||"draft"}</span>
                  </div>
                </div>
                <div class="detail-middle-col">
                  <span class="detail-subheading">Resolution</span>
                  <span style="font-weight: 700; font-size: 0.95rem;">${s.width||1920}x${s.height||1080}</span>
                </div>
                <div class="detail-right-customer">
                  <div class="customer-avatar">TE</div>
                  <div class="customer-info">
                    <span class="customer-name">${s.name}</span>
                    <span class="customer-sub">Local Project</span>
                  </div>
                </div>
              </div>

              <!-- 3 Mini Bento Stat Cards -->
              <div class="mini-bento-stats-grid">
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${E(s.total_duration||s.duration||0)}</span>
                    <span class="mini-stat-arrow">↗</span>
                  </div>
                  <span class="mini-stat-label">Footage Length</span>
                </div>
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${s.media_count||0} clips</span>
                    <span class="mini-stat-arrow">↗</span>
                  </div>
                  <span class="mini-stat-label">Media Items</span>
                </div>
                <div class="mini-bento-stat">
                  <div class="mini-stat-top">
                    <span class="mini-stat-value">${s.fps||30} FPS</span>
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
          `:`
            <div style="text-align: center; margin: auto; color: var(--text-muted);">
              Select a project from the left panel to inspect details.
            </div>
          `}
        </div>
      </div>
    </div>
  `}function Et(){return[{id:"tool-auto-edit",icon:"✂️",name:"Auto Edit"},{id:"tool-auto-caption",icon:"💬",name:"Auto Captions"},{id:"tool-silence",icon:"🔇",name:"Remove Silence"},{id:"tool-retakes",icon:"🔄",name:"Remove Retakes"},{id:"tool-voice",icon:"🎙️",name:"Voice Enhance"},{id:"tool-video",icon:"✨",name:"Video Enhance"},{id:"tool-subtitles",icon:"🌐",name:"Translator"}].map(s=>`
    <div class="quick-tool-tile" data-tool="${s.id}">
      <div class="quick-tool-icon">${s.icon}</div>
      <span class="quick-tool-name">${s.name}</span>
    </div>
  `).join("")}function $t(){const t=e.selectedProject,s=e.selectedMedia;return`
    <div class="editor-view-container">
      <!-- Editor Top Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn-dark-pill" id="btn-back-to-home">
            ← Projects
          </button>
          <div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: #ffffff;">
              <span style="font-family: var(--font-mono); color: var(--accent-lime);"># ${t?t.id:""}</span>
              ${t?t.name:"Untitled Project"}
            </h2>
            <span style="font-size: 0.75rem; color: var(--text-muted);">
              ${s?`${s.file_name} • ${s.width}x${s.height} • ${s.fps} fps`:"No media selected"}
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="btn-dark-pill" id="btn-editor-import">
            + Import Media
          </button>
          <button class="btn-dark-pill" id="btn-toggle-proposed-cuts">
            ✂️ Proposed Edits (${e.proposedCuts.length})
          </button>
        </div>
      </div>

      <!-- Main Editor Bento Layout -->
      <div class="editor-workspace">
        <!-- Left Column: Video Preview Monitor & Transcribe Setup Panel -->
        <div class="editor-left-column">
          ${kt()}
          ${jt()}
        </div>

        <!-- Right Column: Transcript Card -->
        <div class="editor-right-column">
          ${St()}
        </div>
      </div>

      <!-- Bottom Section: Timeline & Proposed Cuts Drawer -->
      <div class="editor-bottom-section">
        ${G()}
        ${xt()}
      </div>
    </div>
  `}function kt(){const t=e.selectedMedia,s=t?e.streamMode==="proxy"&&t.proxy_path?`/api/media/${t.id}/proxy/stream`:`/api/media/${t.id}/stream`:"";return`
    <div class="bento-card" style="padding: 0; overflow: hidden; background-color: #0b0d12;">
      <!-- Monitor Header -->
      <div class="monitor-header">
        <div class="monitor-title-box">
          <span style="font-size: 0.85rem; font-weight: 700;">Studio Monitor</span>
          <span class="badge-tag">${t?`${t.video_codec||"Video"} (${t.width}x${t.height})`:"Empty"}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="stream-toggle-pill">
            <button class="stream-toggle-btn ${e.streamMode==="source"?"active":""}" data-stream="source">Original</button>
            <button class="stream-toggle-btn ${e.streamMode==="proxy"?"active":""}" data-stream="proxy" ${(t==null?void 0:t.proxy_status)!=="ready"?'title="Proxy not yet ready"':""}>Proxy (720p)</button>
          </div>
        </div>
      </div>

      <!-- Monitor Viewport Wrapper -->
      <div class="monitor-viewport-wrapper" id="monitor-viewport">
        ${s?`
          <video id="studio-video" class="monitor-video" src="${s}" preload="metadata"></video>
        `:`
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
  `}function jt(){var i,n,o,r,p,m,c;const t=e.selectedMedia,a=((i=e.capabilities)==null?void 0:i.apple_silicon)?"Apple Silicon CPU (int8). Note: CTranslate2/faster-whisper has no MPS backend; CPU int8 is optimal.":"CTranslate2 faster-whisper CPU (int8)";return`
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
            <option value="tiny" ${e.selectedModel==="tiny"?"selected":""}>Tiny (~75MB) • 10x Speed</option>
            <option value="base" ${e.selectedModel==="base"?"selected":""}>Base (~150MB) • 7x Speed</option>
            <option value="small" ${e.selectedModel==="small"?"selected":""}>Small (~500MB) • 4x (Recommended)</option>
            <option value="medium" ${e.selectedModel==="medium"?"selected":""}>Medium (~1.5GB) • 2x Accurate</option>
            <option value="large-v3" ${e.selectedModel==="large-v3"?"selected":""}>Large-v3 (~3GB) • State of Art</option>
          </select>
        </div>

        <div class="config-field">
          <label class="config-label">Spoken Language</label>
          <select class="custom-select" id="select-whisper-language">
            <option value="auto" ${e.selectedLanguage==="auto"?"selected":""}>Auto Detect</option>
            <option value="en" ${e.selectedLanguage==="en"?"selected":""}>English</option>
            <option value="ta" ${e.selectedLanguage==="ta"?"selected":""}>Tamil (தமிழ்)</option>
            <option value="hi" ${e.selectedLanguage==="hi"?"selected":""}>Hindi (हिन्दी)</option>
            <option value="te" ${e.selectedLanguage==="te"?"selected":""}>Telugu (తెలుగు)</option>
            <option value="ml" ${e.selectedLanguage==="ml"?"selected":""}>Malayalam (മലയാളം)</option>
            <option value="kn" ${e.selectedLanguage==="kn"?"selected":""}>Kannada (ಕನ್ನಡ)</option>
            <option value="bn" ${e.selectedLanguage==="bn"?"selected":""}>Bengali (বাংলা)</option>
          </select>
        </div>

        <button class="btn-lime" id="btn-start-transcribe" ${t?"":"disabled"} style="height: 38px;">
          Transcribe Now
        </button>
      </div>

      <div class="device-badge-note">
        💡 <strong>Device Selection:</strong> ${a}
      </div>

      <!-- Real Job Progress Stepper -->
      <div class="job-progress-stepper" id="job-progress-stepper" style="${e.activeJob&&e.activeJob.status==="running"?"":"display: none;"}">
        <div class="stepper-header">
          <span id="stepper-status-msg">${((n=e.activeJob)==null?void 0:n.message)||"Processing..."}</span>
          <span id="stepper-pct" style="font-family: var(--font-mono); font-weight: 700; color: var(--accent-lime);">${Math.round(((o=e.activeJob)==null?void 0:o.progress)||0)}%</span>
        </div>
        <div class="stepper-steps-row">
          <div class="step-chip ${((r=e.activeJob)==null?void 0:r.step)==="extracting_audio"?"active":""}" id="step-extract">1. Audio Extract</div>
          <div class="step-chip ${((p=e.activeJob)==null?void 0:p.step)==="loading_model"?"active":""}" id="step-model">2. Load Model</div>
          <div class="step-chip ${((m=e.activeJob)==null?void 0:m.step)==="transcribing"?"active":""}" id="step-transcribe">3. Transcribing</div>
        </div>
        <div class="real-progress-bar">
          <div class="real-progress-fill" id="stepper-progress-fill" style="width: ${((c=e.activeJob)==null?void 0:c.progress)||0}%;"></div>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button class="btn-icon-tiny" id="btn-cancel-job" style="color: #f87171;">✕ Cancel Job</button>
        </div>
      </div>
    </div>
  `}function St(){const t=e.transcript,s=(t==null?void 0:t.segments)||[];return`
    <div class="transcript-card" id="transcript-card">
      <!-- Notched Segmented Control: Original / Romanized / Translation -->
      <div class="transcript-header-tabs">
        <div class="transcript-notched-control">
          <button class="transcript-tab-btn active" data-tab="original">Original</button>
          <button class="transcript-tab-btn disabled-tab" data-tab="romanized" title="Phase 6">Romanized (Not configured)</button>
          <button class="transcript-tab-btn disabled-tab" data-tab="translation" title="Phase 6">Translation (Not configured)</button>
        </div>
        <span class="badge-tag" style="font-family: var(--font-mono); font-size: 0.72rem;">
          ${s.length} segments
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
          <button class="btn-icon-tiny" id="btn-export-txt" title="Export as TXT" ${t?"":"disabled"}>
            📥 Export TXT
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="transcript-search-bar" id="transcript-search-bar" style="display: ${e.transcriptSearchQuery?"flex":"none"};">
        <div class="search-input-line">
          <span>🔍</span>
          <input type="text" id="transcript-search-input" placeholder="Search in transcript..." value="${e.transcriptSearchQuery}">
          <button class="btn-icon-tiny" id="btn-close-search">✕</button>
        </div>
        <div class="search-hits-strip" id="search-hits-strip">
          ${e.transcriptSearchHits.map(a=>`
            <span class="search-hit-chip" data-seek="${a.start}">
              ${$(a.start)}: ${a.word}
            </span>
          `).join("")}
        </div>
      </div>

      <!-- Segments Scroll List -->
      <div class="segments-scroll-box" id="segments-container">
        ${s.length===0?`
          <div style="color: var(--text-muted); text-align: center; margin: auto; padding: 40px 20px;">
            <p>No transcript generated yet.</p>
            <p style="font-size: 0.8rem; margin-top: 6px;">Select model and click <strong>Transcribe Now</strong> to start.</p>
          </div>
        `:s.map(a=>Z(a)).join("")}
      </div>

      <!-- Floating Jump to Current Sentence Button -->
      <div class="jump-to-current-chip" id="jump-to-current-chip" style="display: none;">
        <span>↓ Jump to current</span>
      </div>
    </div>
  `}function Z(t){const s=t.words||[],a=t._isEditing;return`
    <div class="segment-item-block ${e.activeSegmentId===t.id?"active-sentence":""}" id="seg-block-${t.id}" data-segment-id="${t.id}">
      <div class="segment-top-row">
        <span class="segment-time-pill" data-seek="${t.start}" title="Click to seek">
          ${$(t.start)}
        </span>
        <div class="segment-hover-actions">
          <button class="btn-seg-action" data-action="play-seg" data-seek="${t.start}" title="Play from here">▶</button>
          <button class="btn-seg-action" data-action="edit-seg" data-id="${t.id}" title="Edit text">✏️ Edit</button>
          <button class="btn-seg-action cut-btn" data-action="cut-seg" data-id="${t.id}" title="Propose cut (EDL)">✂️ Remove</button>
        </div>
      </div>

      ${a?`
        <div class="segment-edit-box">
          <textarea class="segment-edit-textarea" id="textarea-seg-${t.id}">${t.text}</textarea>
          <div class="edit-actions-row">
            <button class="btn-icon-tiny" data-action="cancel-edit" data-id="${t.id}">Cancel</button>
            <button class="btn-lime" data-action="save-edit" data-id="${t.id}" style="padding: 4px 12px; font-size: 0.78rem;">Save</button>
          </div>
        </div>
      `:`
        <div class="segment-text-flow" data-segment-id="${t.id}">
          ${s.length>0?s.map(i=>{const n=i.confidence!==void 0&&i.confidence<.7;return`
              <span class="karaoke-word ${e.activeWordId===i.id?"active-word":""} ${n?"low-confidence":""}" 
                    id="word-${i.id}"
                    data-word-id="${i.id}"
                    data-start="${i.start}"
                    data-end="${i.end}"
                    ${n?`data-tooltip="Confidence: ${Math.round(i.confidence*100)}%"`:""}
                    title="Click to seek (${i.start}s)">
                ${i.text}
              </span>
            `}).join(""):t.text}
        </div>
      `}
    </div>
  `}function G(){const t=e.proposedCuts||[];return`
    <div class="proposed-edits-panel" id="proposed-edits-panel">
      <div class="proposed-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>✂️</span>
          <span>Proposed Edits (EDL)</span>
          <span class="badge-tag" style="background-color: rgba(239, 68, 68, 0.15); color: #f87171;">
            ${t.length} proposed cuts
          </span>
        </div>
        <span style="font-size: 0.75rem; color: #94a3b8;">
          Cuts are non-destructive proposals. Original media files remain untouched.
        </span>
      </div>

      <div class="proposed-cuts-list">
        ${t.length===0?`
          <div style="color: var(--text-muted); font-size: 0.8rem; padding: 8px 0;">
            No proposed cuts yet. Hover over any sentence in the transcript and click <strong>✂️ Remove</strong> to propose a cut.
          </div>
        `:t.map(s=>`
          <div class="proposed-cut-item">
            <div class="cut-info-left">
              <span class="cut-time-range">${$(s.start_time)} - ${$(s.end_time)}</span>
              <span class="cut-snippet">"${s.text||"Cut segment"}"</span>
              <span class="status-pill ${s.status}">${s.status}</span>
            </div>
            <div class="cut-actions-right">
              ${s.status==="proposed"?`
                <button class="btn-icon-tiny" data-action="accept-cut" data-id="${s.id}" style="color: var(--accent-lime);">✓ Accept</button>
                <button class="btn-icon-tiny" data-action="ignore-cut" data-id="${s.id}" style="color: #94a3b8;">✕ Ignore</button>
              `:`
                <button class="btn-icon-tiny" data-action="reset-cut" data-id="${s.id}">Reset</button>
              `}
              <button class="btn-icon-tiny" data-action="delete-cut" data-id="${s.id}" title="Undo proposal" style="color: #f87171;">Undo</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `}function xt(){var s,a;const t=((s=e.selectedMedia)==null?void 0:s.duration)||0;return`
    <div class="timeline-placeholder-card">
      <div class="timeline-card-header">
        <h3 class="timeline-card-title">
          <span>🎞️</span>
          <span>Timeline Studio (Phase 3 Foundation)</span>
        </h3>
        <span style="font-size: 0.75rem; color: #94a3b8;">
          EDL Duration: ${E(t)}
        </span>
      </div>
      <div class="timeline-tracks-mock">
        <div class="mock-track-row">
          <span class="track-header-badge">Video 1</span>
          <div class="mock-track-strip">
            ${e.selectedMedia?`${e.selectedMedia.file_name} [${E(t)}]`:"Main Video Track"}
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
            ${e.transcript?`${((a=e.transcript.segments)==null?void 0:a.length)||0} transcript caption blocks`:"No captions generated"}
          </div>
        </div>
      </div>
    </div>
  `}function Tt(){var t,s,a,i,n,o,r,p,m,c;(t=document.getElementById("nav-btn-home"))==null||t.addEventListener("click",()=>{e.currentView="home",w()}),(s=document.getElementById("nav-btn-editor"))==null||s.addEventListener("click",()=>{if(!e.selectedProject){d("Select a project first");return}P(e.selectedProject.id)}),(a=document.getElementById("btn-new-project"))==null||a.addEventListener("click",Rt),(i=document.getElementById("btn-import-local-home"))==null||i.addEventListener("click",Y),(n=document.getElementById("btn-quick-import"))==null||n.addEventListener("click",Dt),(o=document.getElementById("project-search-input"))==null||o.addEventListener("input",u=>{e.searchQuery=u.target.value,U()}),document.querySelectorAll(".notched-tab-btn").forEach(u=>{u.addEventListener("click",()=>{e.activeFilter=u.dataset.filter,U()})}),document.querySelectorAll(".project-item-row").forEach(u=>{u.addEventListener("click",()=>{const b=u.dataset.projectId,g=e.projects.find(h=>h.id===b);g&&(e.selectedProject=g,w())})}),(r=document.getElementById("btn-open-in-editor"))==null||r.addEventListener("click",()=>{e.selectedProject&&P(e.selectedProject.id)}),(p=document.getElementById("btn-duplicate-proj"))==null||p.addEventListener("click",Ft),(m=document.getElementById("btn-delete-proj"))==null||m.addEventListener("click",Nt),(c=document.getElementById("btn-back-to-home"))==null||c.addEventListener("click",()=>{e.currentView="home",w()}),It(),Ct(),_t(),X()}function It(){var n,o,r,p,m,c,u,b,g,h;const t=document.getElementById("studio-video");if(!t)return;t.addEventListener("timeupdate",()=>{e.currentTime=t.currentTime,Mt(t.currentTime),z(t.currentTime,t.duration),Pt(t.currentTime)}),t.addEventListener("loadedmetadata",()=>{e.duration=t.duration,z(0,t.duration)}),t.addEventListener("play",()=>{e.isPlaying=!0;const l=document.getElementById("btn-play-pause");l&&(l.textContent="⏸ Pause")}),t.addEventListener("pause",()=>{e.isPlaying=!1;const l=document.getElementById("btn-play-pause");l&&(l.textContent="▶ Play")}),(n=document.getElementById("btn-play-pause"))==null||n.addEventListener("click",()=>{t.paused?t.play():t.pause()});const a=1/(((o=e.selectedMedia)==null?void 0:o.fps)||30);(r=document.getElementById("btn-frame-back"))==null||r.addEventListener("click",()=>{t.pause(),t.currentTime=Math.max(0,t.currentTime-a)}),(p=document.getElementById("btn-frame-fwd"))==null||p.addEventListener("click",()=>{t.pause(),t.currentTime=Math.min(t.duration||0,t.currentTime+a)});const i=document.getElementById("video-scrubber");i&&i.addEventListener("input",l=>{const y=parseFloat(l.target.value);t.duration&&(t.currentTime=y/100*t.duration)}),(m=document.getElementById("select-playback-speed"))==null||m.addEventListener("change",l=>{t.playbackRate=parseFloat(l.target.value),e.playbackRate=t.playbackRate}),(c=document.getElementById("select-aspect-overlay"))==null||c.addEventListener("change",l=>{e.selectedAspect=l.target.value,Lt()}),(u=document.getElementById("select-safe-zone"))==null||u.addEventListener("change",l=>{e.selectedSafeZone=l.target.value,Bt()}),(b=document.getElementById("btn-volume-mute"))==null||b.addEventListener("click",()=>{t.muted=!t.muted,e.isMuted=t.muted;const l=document.getElementById("btn-volume-mute");l&&(l.textContent=t.muted?"🔇":"🔊")}),(g=document.getElementById("volume-slider"))==null||g.addEventListener("input",l=>{t.volume=parseFloat(l.target.value),t.muted=!1}),(h=document.getElementById("btn-fullscreen"))==null||h.addEventListener("click",()=>{const l=document.getElementById("monitor-viewport");l&&(document.fullscreenElement?document.exitFullscreen():l.requestFullscreen())}),document.querySelectorAll(".stream-toggle-btn").forEach(l=>{l.addEventListener("click",()=>{var v;const y=l.dataset.stream;if(y==="proxy"&&((v=e.selectedMedia)==null?void 0:v.proxy_status)!=="ready"){d("Proxy is not yet generated");return}e.streamMode=y;const S=t.currentTime;t.src=y==="proxy"?`/api/media/${e.selectedMedia.id}/proxy/stream`:`/api/media/${e.selectedMedia.id}/stream`,t.currentTime=S,w()})})}function z(t,s){const a=document.getElementById("scrub-current-time"),i=document.getElementById("scrub-total-duration"),n=document.getElementById("video-scrubber");a&&(a.textContent=E(t)),i&&s&&(i.textContent=E(s)),n&&s>0&&(n.value=t/s*100)}function Pt(t){var a;const s=document.getElementById("floating-timecode");if(s){const i=((a=e.selectedMedia)==null?void 0:a.fps)||30;s.textContent=mt(t,i)}}function Lt(){const t=document.getElementById("aspect-overlay-box");if(t){if(e.selectedAspect==="original"){t.style.display="none";return}t.style.display="block",e.selectedAspect==="9:16"?(t.style.width="292px",t.style.height="520px"):e.selectedAspect==="1:1"?(t.style.width="500px",t.style.height="500px"):e.selectedAspect==="4:5"?(t.style.width="416px",t.style.height="520px"):(t.style.width="100%",t.style.height="100%")}}function Bt(){const t=document.getElementById("safe-zone-box");if(t){if(e.selectedSafeZone==="none"){t.style.display="none",t.innerHTML="";return}t.style.display="block",e.selectedSafeZone==="instagram"?t.innerHTML=`
      <div class="safe-zone-instagram">
        <span class="safe-zone-label">Instagram Reels UI Safe Area</span>
      </div>
    `:e.selectedSafeZone==="tiktok"?t.innerHTML=`
      <div class="safe-zone-instagram" style="bottom: 24%; right: 16%;">
        <span class="safe-zone-label">TikTok UI Safe Area</span>
      </div>
    `:e.selectedSafeZone==="youtube"&&(t.innerHTML=`
      <div class="safe-zone-instagram" style="top: 10%; bottom: 18%;">
        <span class="safe-zone-label">YouTube Shorts Safe Area</span>
      </div>
    `)}}function Mt(t){if(!e.transcript||!e.transcript.segments)return;let s=null,a=null;for(const i of e.transcript.segments)if(t>=i.start&&t<=i.end){if(s=i,i.words){for(const n of i.words)if(t>=n.start&&t<=n.end){a=n;break}}break}if(s&&s.id!==e.activeSegmentId){e.activeSegmentId=s.id,document.querySelectorAll(".segment-item-block").forEach(n=>n.classList.remove("active-sentence"));const i=document.getElementById(`seg-block-${s.id}`);i&&(i.classList.add("active-sentence"),e.isUserScrollingTranscript||i.scrollIntoView({behavior:"smooth",block:"nearest"}))}if(a&&a.id!==e.activeWordId){e.activeWordId=a.id,document.querySelectorAll(".karaoke-word").forEach(n=>n.classList.remove("active-word"));const i=document.getElementById(`word-${a.id}`);i&&i.classList.add("active-word")}}function Ct(){var t,s,a,i;(t=document.getElementById("select-whisper-model"))==null||t.addEventListener("change",n=>{e.selectedModel=n.target.value}),(s=document.getElementById("select-whisper-language"))==null||s.addEventListener("change",n=>{e.selectedLanguage=n.target.value}),(a=document.getElementById("btn-start-transcribe"))==null||a.addEventListener("click",async()=>{if(!e.selectedMedia){d("Select a media clip to transcribe");return}try{const n=document.getElementById("job-progress-stepper");n&&(n.style.display="flex");const o=await ot(e.selectedMedia.id,e.selectedModel,e.selectedLanguage);d(`Transcription started (${e.selectedModel})`),e.activeJob={job_id:o.job_id,status:"queued",progress:0,step:"extracting_audio",message:"Job queued..."}}catch(n){d(`Failed: ${n.message}`)}}),(i=document.getElementById("btn-cancel-job"))==null||i.addEventListener("click",async()=>{if(e.activeJob&&e.activeJob.job_id)try{await ct(e.activeJob.job_id),d("Transcription job cancelled")}catch(n){d(`Cancel failed: ${n.message}`)}})}function J(t){const s=document.getElementById("job-progress-stepper");if(!s)return;t.status==="running"?s.style.display="flex":(t.status==="completed"||t.status==="cancelled")&&setTimeout(()=>{s.style.display="none"},2e3);const a=document.getElementById("stepper-status-msg"),i=document.getElementById("stepper-pct"),n=document.getElementById("stepper-progress-fill");a&&(a.textContent=t.message||"Processing..."),i&&(i.textContent=`${Math.round(t.progress||0)}%`),n&&(n.style.width=`${t.progress||0}%`);const o=document.getElementById("step-extract"),r=document.getElementById("step-model"),p=document.getElementById("step-transcribe");t.step==="extracting_audio"?(o==null||o.classList.add("active"),r==null||r.classList.remove("active"),p==null||p.classList.remove("active")):t.step==="loading_model"?(o==null||o.classList.add("done"),r==null||r.classList.add("active"),p==null||p.classList.remove("active")):t.step==="transcribing"&&(o==null||o.classList.add("done"),r==null||r.classList.add("done"),p==null||p.classList.add("active"))}function _t(){var a,i,n,o,r,p,m;const t=document.getElementById("segments-container");t&&t.addEventListener("scroll",()=>{e.isUserScrollingTranscript=!0;const c=document.getElementById("jump-to-current-chip");c&&(c.style.display="flex"),e.transcriptScrollTimeout&&clearTimeout(e.transcriptScrollTimeout),e.transcriptScrollTimeout=setTimeout(()=>{},3e3)}),(a=document.getElementById("jump-to-current-chip"))==null||a.addEventListener("click",()=>{e.isUserScrollingTranscript=!1;const c=document.getElementById("jump-to-current-chip");if(c&&(c.style.display="none"),e.activeSegmentId){const u=document.getElementById(`seg-block-${e.activeSegmentId}`);u&&u.scrollIntoView({behavior:"smooth",block:"center"})}}),(i=document.getElementById("btn-undo-transcript"))==null||i.addEventListener("click",K),(n=document.getElementById("btn-redo-transcript"))==null||n.addEventListener("click",Q),L(),(o=document.getElementById("btn-toggle-search"))==null||o.addEventListener("click",()=>{var u;const c=document.getElementById("transcript-search-bar");c&&(c.style.display=c.style.display==="none"?"flex":"none",c.style.display==="flex"&&((u=document.getElementById("transcript-search-input"))==null||u.focus()))}),(r=document.getElementById("btn-close-search"))==null||r.addEventListener("click",()=>{const c=document.getElementById("transcript-search-bar");c&&(c.style.display="none"),e.transcriptSearchQuery="",e.transcriptSearchHits=[]});let s=null;(p=document.getElementById("transcript-search-input"))==null||p.addEventListener("input",c=>{const u=c.target.value;e.transcriptSearchQuery=u,s&&clearTimeout(s),s=setTimeout(async()=>{if(!u.trim()||!e.selectedMedia){e.transcriptSearchHits=[],O();return}try{const b=await rt(e.selectedMedia.id,u),g=[];b.matches.forEach(h=>{h.matched_words.forEach(l=>{g.push({start:l.start,word:l.text})})}),e.transcriptSearchHits=g,O()}catch(b){console.warn("Search error:",b)}},250)}),(m=document.getElementById("btn-export-txt"))==null||m.addEventListener("click",()=>{e.selectedMedia&&(window.open(pt(e.selectedMedia.id),"_blank"),d("Exporting transcript as TXT..."))}),t==null||t.addEventListener("click",c=>{const u=c.target.closest(".karaoke-word");if(u){const v=parseFloat(u.dataset.start);T(v);return}const b=c.target.closest(".segment-time-pill");if(b){const v=parseFloat(b.dataset.seek);T(v);return}const g=c.target.closest('[data-action="play-seg"]');if(g){const v=parseFloat(g.dataset.seek);T(v,!0);return}const h=c.target.closest('[data-action="edit-seg"]');if(h){const v=h.dataset.id;_(v,!0);return}const l=c.target.closest('[data-action="cancel-edit"]');if(l){const v=l.dataset.id;_(v,!1);return}const y=c.target.closest('[data-action="save-edit"]');if(y){const v=y.dataset.id,F=document.getElementById(`textarea-seg-${v}`);if(F&&e.transcript){const N=e.transcript.segments.find(x=>x.id===v);if(N){const x=N.text,R=F.value.trim();x!==R?ft(new vt(e.transcript.id,v,x,R)):_(v,!1)}}return}const S=c.target.closest('[data-action="cut-seg"]');if(S){const v=S.dataset.id;At(v);return}})}function O(){const t=document.getElementById("search-hits-strip");t&&(t.innerHTML=e.transcriptSearchHits.map(s=>`
    <span class="search-hit-chip" data-seek="${s.start}">
      ${$(s.start)}: ${s.word}
    </span>
  `).join(""),t.querySelectorAll(".search-hit-chip").forEach(s=>{s.addEventListener("click",()=>{const a=parseFloat(s.dataset.seek);T(a)})}))}function _(t,s){if(!e.transcript||!e.transcript.segments)return;const a=e.transcript.segments.find(i=>i.id===t);a&&(a._isEditing=s,I())}function I(){const t=document.getElementById("segments-container");!t||!e.transcript||(t.innerHTML=e.transcript.segments.map(s=>Z(s)).join(""))}function T(t,s=!1){const a=document.getElementById("studio-video");a&&(a.currentTime=Math.max(0,t),s&&a.play())}function X(){var s;const t=document.getElementById("proposed-edits-panel");t&&(t.addEventListener("click",async a=>{const i=a.target.closest('[data-action="accept-cut"]');if(i){await C(i.dataset.id,"accepted"),await j(),d("Cut accepted");return}const n=a.target.closest('[data-action="ignore-cut"]');if(n){await C(n.dataset.id,"ignored"),await j(),d("Cut ignored");return}const o=a.target.closest('[data-action="reset-cut"]');if(o){await C(o.dataset.id,"proposed"),await j();return}const r=a.target.closest('[data-action="delete-cut"]');if(r){await lt(r.dataset.id),await j(),d("Cut proposal removed");return}}),(s=document.getElementById("btn-toggle-proposed-cuts"))==null||s.addEventListener("click",()=>{t.scrollIntoView({behavior:"smooth"})}))}async function At(t){if(!e.transcript||!e.selectedProject||!e.selectedMedia)return;const s=e.transcript.segments.find(a=>a.id===t);if(s)try{await dt(e.selectedProject.id,{media_id:e.selectedMedia.id,segment_id:s.id,start_time:s.start,end_time:s.end,text:s.text}),await j(),d(`Proposed cut created: [${$(s.start)} - ${$(s.end)}]`)}catch(a){d(`Failed to propose cut: ${a.message}`)}}async function j(){if(!e.selectedProject)return;e.proposedCuts=await W(e.selectedProject.id);const t=document.getElementById("proposed-edits-panel");t&&(t.outerHTML=G(),X())}async function B(){if(e.selectedMedia)try{const t=await q(e.selectedMedia.id);e.transcript=t,I()}catch(t){console.warn("Reload transcript error:",t)}}async function P(t){try{const s=await st(t);if(e.selectedProject=s,e.activeProjectDetails=s,s.media&&s.media.length>0?e.selectedMedia=s.media[0]:e.selectedMedia=null,e.currentView="editor",e.selectedMedia){const a=await q(e.selectedMedia.id);e.transcript=a}else e.transcript=null;e.proposedCuts=await W(t),e.undoStack=[],e.redoStack=[],w()}catch(s){d(`Failed to open project: ${s.message}`)}}async function M(){try{const[t,s]=await Promise.all([V(),A(e.activeFilter,e.searchQuery)]);e.stats=t,e.projects=s,e.selectedProject&&(e.selectedProject=s.find(a=>a.id===e.selectedProject.id)||s[0]),w()}catch(t){console.warn("Refresh error:",t)}}async function U(){try{const t=await A(e.activeFilter,e.searchQuery);e.projects=t;const s=document.querySelector(".project-list-items");s&&(s.innerHTML=t.length===0?`
        <div class="empty-projects-state"><p>No projects match your filter.</p></div>
      `:t.map(a=>`
        <div class="project-item-row ${e.selectedProject&&e.selectedProject.id===a.id?"selected":""}" data-project-id="${a.id}">
          <div class="item-left-group">
            <div class="item-thumbnail">
              ${a.thumbnail_path?`<img src="${a.thumbnail_path}" alt="Thumb" />`:"🎬"}
            </div>
            <div class="item-text-info">
              <span class="item-id"># ${a.id}</span>
              <span class="item-name" style="font-size: 0.82rem; font-weight: 600;">${a.name}</span>
              <span class="item-date">${a.aspect_ratio||"16:9"} • ${a.fps||30} fps</span>
            </div>
          </div>
          <div class="item-right-group">
            <span class="status-pill ${a.status||"draft"}">${a.status||"draft"}</span>
            <span class="item-amount">${E(a.total_duration||a.duration||0)}</span>
          </div>
        </div>
      `).join(""),s.querySelectorAll(".project-item-row").forEach(a=>{a.addEventListener("click",()=>{const i=a.dataset.projectId;e.selectedProject=e.projects.find(n=>n.id===i),w()})}))}catch(t){console.warn(t)}}async function Ft(){if(e.selectedProject)try{const t=await at(e.selectedProject.id);d(`Project duplicated as #${t.id}`),await M()}catch(t){d(`Duplicate failed: ${t.message}`)}}async function Nt(){if(e.selectedProject&&confirm(`Are you sure you want to delete Project #${e.selectedProject.id}? This will remove all associated timeline and proxy assets.`))try{await nt(e.selectedProject.id),d("Project deleted"),e.selectedProject=null,await M()}catch(t){d(`Delete failed: ${t.message}`)}}function Rt(){var s,a,i;document.body.insertAdjacentHTML("beforeend",`
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
  `),(s=document.getElementById("modal-close-btn"))==null||s.addEventListener("click",k),(a=document.getElementById("modal-cancel-btn"))==null||a.addEventListener("click",k),(i=document.getElementById("modal-submit-create"))==null||i.addEventListener("click",async()=>{var r,p;const n=(r=document.getElementById("inp-proj-name"))==null?void 0:r.value.trim(),o=(p=document.getElementById("inp-proj-aspect"))==null?void 0:p.value;if(!n){d("Enter a project name");return}try{const m=await et({name:n,aspect_ratio:o});k(),d(`Created project #${m.id}`),e.selectedProject=m,await M(),P(m.id)}catch(m){d(`Error: ${m.message}`)}})}function Y(){var s,a,i;if(!e.selectedProject){d("Select or create a project first");return}document.body.insertAdjacentHTML("beforeend",`
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
  `),(s=document.getElementById("modal-close-btn"))==null||s.addEventListener("click",k),(a=document.getElementById("modal-cancel-btn"))==null||a.addEventListener("click",k),(i=document.getElementById("modal-submit-import"))==null||i.addEventListener("click",async()=>{var o;const n=(o=document.getElementById("inp-local-path"))==null?void 0:o.value.trim();if(n)try{d("Importing and probing file...");const r=await it(e.selectedProject.id,n);k(),d(`Imported ${r.file_name} (${r.width}x${r.height})`),await P(e.selectedProject.id)}catch(r){d(`Import error: ${r.message}`)}})}function Dt(){Y()}function k(){document.querySelectorAll(".modal-overlay").forEach(t=>t.remove())}function Ht(t){var s,a,i;if(t.code==="Space"&&!["INPUT","TEXTAREA"].includes(t.target.tagName)){t.preventDefault();const n=document.getElementById("studio-video");n&&(n.paused?n.play():n.pause());return}if(t.code==="ArrowLeft"&&!["INPUT","TEXTAREA"].includes(t.target.tagName)){t.preventDefault();const n=document.getElementById("studio-video");if(n){n.pause();const o=((s=e.selectedMedia)==null?void 0:s.fps)||30;n.currentTime=Math.max(0,n.currentTime-1/o)}return}if(t.code==="ArrowRight"&&!["INPUT","TEXTAREA"].includes(t.target.tagName)){t.preventDefault();const n=document.getElementById("studio-video");if(n){n.pause();const o=((a=e.selectedMedia)==null?void 0:a.fps)||30;n.currentTime=Math.min(n.duration||0,n.currentTime+1/o)}return}if((t.metaKey||t.ctrlKey)&&t.key.toLowerCase()==="f"){if(e.currentView==="editor"){t.preventDefault();const n=document.getElementById("transcript-search-bar");n&&(n.style.display="flex",(i=document.getElementById("transcript-search-input"))==null||i.focus())}return}if((t.metaKey||t.ctrlKey)&&!t.shiftKey&&t.key.toLowerCase()==="z"){e.currentView==="editor"&&(t.preventDefault(),K());return}if((t.metaKey||t.ctrlKey)&&t.shiftKey&&t.key.toLowerCase()==="z"||(t.metaKey||t.ctrlKey)&&t.key.toLowerCase()==="y"){e.currentView==="editor"&&(t.preventDefault(),Q());return}}function d(t){const s=document.getElementById("toast-root")||document.body,a=document.createElement("div");a.className="toast-msg",a.textContent=t,s.appendChild(a),setTimeout(()=>{a.remove()},3500)}window.addEventListener("DOMContentLoaded",bt);
