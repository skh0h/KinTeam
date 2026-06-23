import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
          <div className="max-w-sm w-full rounded-xl border bg-card text-card-foreground shadow-sm p-8 space-y-4">
            <div className="text-4xl">🔧</div>
            <h2 className="text-xl font-semibold tracking-tight">Something went sideways</h2>
            <p className="text-sm text-muted-foreground">
              This page hit an unexpected error. Your other pages are still working — use the nav
              above to get back on track, or reload to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
