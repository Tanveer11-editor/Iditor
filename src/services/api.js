/**
 * TANEDIT AI REST API Service
 */

const API_BASE = '/api';

export async function fetchCapabilities() {
  const res = await fetch(`${API_BASE}/system/capabilities`);
  if (!res.ok) throw new Error('Failed to fetch capabilities');
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/system/stats`);
  if (!res.ok) throw new Error('Failed to fetch system stats');
  return res.json();
}

export async function fetchProjects(status = '', query = '') {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (query) params.append('q', query);

  const res = await fetch(`${API_BASE}/projects?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
}

export async function createProject(data) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function fetchProject(id) {
  const res = await fetch(`${API_BASE}/projects/${id}`);
  if (!res.ok) throw new Error('Failed to load project details');
  return res.json();
}

export async function duplicateProject(id) {
  const res = await fetch(`${API_BASE}/projects/${id}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to duplicate project');
  return res.json();
}

export async function deleteProject(id) {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete project');
  return res.json();
}

export async function uploadMedia(file, projectId, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  if (projectId) formData.append('project_id', projectId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/media/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err) {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export async function importLocalPath(projectId, filePath) {
  const res = await fetch(`${API_BASE}/media/import-path`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, file_path: filePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to import local file');
  }
  return res.json();
}

export async function triggerProxy(mediaId, resolution = '720p') {
  const res = await fetch(`${API_BASE}/media/${mediaId}/proxy?resolution=${resolution}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger proxy encoding');
  return res.json();
}

export async function fetchTranscriptionOptions() {
  const res = await fetch(`${API_BASE}/transcription/options`);
  if (!res.ok) throw new Error('Failed to fetch transcription options');
  return res.json();
}

export async function startTranscription(mediaId, model = 'small', language = 'auto') {
  const res = await fetch(`${API_BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_id: mediaId, model, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start transcription');
  }
  return res.json();
}

export async function fetchTranscript(mediaId) {
  const res = await fetch(`${API_BASE}/transcripts/${mediaId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to fetch transcript');
  }
  return res.json();
}

export async function patchSegmentText(transcriptId, segId, text) {
  const res = await fetch(`${API_BASE}/transcripts/${transcriptId}/segments/${segId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update segment');
  }
  return res.json();
}

export async function searchTranscript(mediaId, query) {
  const res = await fetch(`${API_BASE}/transcripts/${mediaId}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search transcript');
  return res.json();
}

export async function cancelJob(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to cancel job');
  return res.json();
}

export async function fetchProposedCuts(projectId) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cuts`);
  if (!res.ok) throw new Error('Failed to load proposed cuts');
  return res.json();
}

export async function createProposedCut(projectId, cutData) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/cuts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cutData),
  });
  if (!res.ok) throw new Error('Failed to create proposed cut');
  return res.json();
}

export async function updateProposedCut(cutId, status) {
  const res = await fetch(`${API_BASE}/cuts/${cutId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update cut status');
  return res.json();
}

export async function deleteProposedCut(cutId) {
  const res = await fetch(`${API_BASE}/cuts/${cutId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete proposed cut');
  return res.json();
}

export function getTranscriptExportUrl(mediaId) {
  return `${API_BASE}/transcripts/${mediaId}/export`;
}

// ==========================================
// PHASE 3: WAVEFORM, SILENCE & EDL SERVICES
// ==========================================

export async function fetchWaveform(mediaId, zoom = 1.0, startTime = 0.0, endTime = null) {
  const params = new URLSearchParams();
  params.append('zoom', zoom);
  if (startTime > 0) params.append('start_time', startTime);
  if (endTime !== null) params.append('end_time', endTime);

  const res = await fetch(`${API_BASE}/media/${mediaId}/waveform?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch waveform peaks');
  return res.json();
}

export async function analyzeSilence({
  mediaId,
  projectId = null,
  thresholdDb = -25.0,
  minDuration = 0.4,
  paddingBefore = 150.0,
  paddingAfter = 150.0,
  mode = 'smart',
  sync = false,
}) {
  const res = await fetch(`${API_BASE}/analyze-silence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_id: mediaId,
      project_id: projectId,
      threshold_db: thresholdDb,
      min_duration: minDuration,
      padding_before: paddingBefore,
      padding_after: paddingAfter,
      mode,
      sync,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to analyze silence');
  }
  return res.json();
}

export async function fetchProjectEdl(projectId) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl`);
  if (!res.ok) throw new Error('Failed to load project EDL');
  return res.json();
}

export async function proposeEdlCuts(projectId, mediaId, spans) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_id: mediaId, spans }),
  });
  if (!res.ok) throw new Error('Failed to propose EDL cuts');
  return res.json();
}

export async function applyEdlCuts(projectId, spanIds = null) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ span_ids: spanIds }),
  });
  if (!res.ok) throw new Error('Failed to apply EDL cuts');
  return res.json();
}

export async function ignoreEdlCuts(projectId, spanIds) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/ignore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ span_ids: spanIds }),
  });
  if (!res.ok) throw new Error('Failed to ignore EDL cuts');
  return res.json();
}

export async function undoEdl(projectId) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/undo`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to undo EDL');
  return res.json();
}

export async function redoEdl(projectId) {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/redo`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to redo EDL');
  return res.json();
}

export async function mapEdlTime(projectId, time, direction = 'original_to_edited') {
  const res = await fetch(`${API_BASE}/projects/${projectId}/edl/map-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time, direction }),
  });
  if (!res.ok) throw new Error('Failed to map EDL time');
  return res.json();
}

