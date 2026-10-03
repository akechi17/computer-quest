import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches render errors so a failure in the 3D scene degrades gracefully
 * instead of blanking the page (spec §30: "display a graceful fallback instead
 * of crashing the entire game").
 *
 * A class component because React still has no hook equivalent for
 * `componentDidCatch`.
 */

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  override render(): ReactNode {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
