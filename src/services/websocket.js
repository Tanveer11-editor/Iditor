/**
 * WebSocket manager for live job progress notifications
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/jobs`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this._notifyListeners({ type: 'ws_status', status: 'connected' });
        // Heartbeat
        this.pingInterval = setInterval(() => {
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send('ping');
          }
        }, 15000);
      };

      this.socket.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const data = JSON.parse(event.data);
          this._notifyListeners(data);
        } catch (e) {
          console.warn('[WS Parse Error]', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        clearInterval(this.pingInterval);
        this._notifyListeners({ type: 'ws_status', status: 'disconnected' });
        this._scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        this.isConnected = false;
        this.socket.close();
      };
    } catch (e) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(data) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('[WS Listener Callback Error]', err);
      }
    });
  }
}

export const wsClient = new WebSocketClient();
