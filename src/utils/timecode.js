/**
 * Timecode and formatting utilities for frame-accurate playback
 */

export function secondsToTimecode(seconds, fps = 30) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const validFps = fps > 0 ? fps : 30;

  const totalFrames = Math.floor(seconds * validFps);
  const frames = totalFrames % Math.round(validFps);
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function timecodeToSeconds(timecode, fps = 30) {
  const parts = timecode.split(':').map(Number);
  if (parts.length !== 4) return 0;
  const [h, m, s, f] = parts;
  const validFps = fps > 0 ? fps : 30;
  return h * 3600 + m * 60 + s + f / validFps;
}

export function formatDuration(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatTimestampMs(seconds) {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsWhole = Math.floor(secs);
  const ms = Math.floor((secs - secsWhole) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(secsWhole).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
