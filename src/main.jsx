import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../style.css'

// Handle Vite dynamic import preload failures automatically
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    console.warn('Vite preload error detected. Auto-reloading page to fetch latest assets...');
    const lastReload = sessionStorage.getItem('nefusoft_vite_preload_reload');
    const now = Date.now();
    if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
      sessionStorage.setItem('nefusoft_vite_preload_reload', String(now));
      window.location.reload();
    }
  });
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Auto-recover if error was caused by a stale or failed dynamic chunk import
    const errorMessage = (error?.message || '').toLowerCase();
    const isChunkError =
      errorMessage.includes('dynamically imported module') ||
      errorMessage.includes('loading chunk') ||
      errorMessage.includes('failed to fetch') ||
      error?.name === 'ChunkLoadError';

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('nefusoft_chunk_auto_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('nefusoft_chunk_auto_reload', String(now));
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'sans-serif', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
          <h2 style={{ fontWeight: 900, fontSize: '20px', marginBottom: '8px' }}>Oops, ada yang error</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '24px' }}>Coba refresh halaman ini</p>
          <button onClick={this.handleReset} style={{ background: '#F6CF80', color: '#0a0a0c', border: 'none', borderRadius: '999px', padding: '12px 28px', fontWeight: 900, fontSize: '13px', cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
