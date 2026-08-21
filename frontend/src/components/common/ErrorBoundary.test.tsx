import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error conditionally
function Bomb({ shouldThrow, message = 'Kaboom!' }: { shouldThrow?: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div>Normal Content</div>;
}

describe('ErrorBoundary Component', () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Suppress console.error during expected boundary error catches in tests
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal Content')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it('renders default section fallback when child throws an error', () => {
    render(
      <ErrorBoundary level="section">
        <Bomb shouldThrow={true} message="Simulation error in sector 2" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred while rendering this section.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Technical Details/i })).toBeInTheDocument();
  });

  it('renders root level fallback with Reload Application button', () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    });

    render(
      <ErrorBoundary level="root">
        <Bomb shouldThrow={true} message="Fatal root crash" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Application Error')).toBeInTheDocument();
    const reloadBtn = screen.getByRole('button', { name: /Reload Application/i });
    expect(reloadBtn).toBeInTheDocument();

    fireEvent.click(reloadBtn);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div data-testid="custom-fallback">Custom Fallback UI</div>}>
        <Bomb shouldThrow={true} message="Failed" />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });

  it('toggles technical details with error message and stack trace', () => {
    render(
      <ErrorBoundary level="widget">
        <Bomb shouldThrow={true} message="Specific Widget Failure" />
      </ErrorBoundary>
    );

    const toggleBtn = screen.getByRole('button', { name: /Technical Details/i });
    expect(screen.queryByText(/Specific Widget Failure/)).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Specific Widget Failure/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide Details/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide Details/i }));
    expect(screen.queryByText(/Specific Widget Failure/)).not.toBeInTheDocument();
  });

  it('calls onReset callback when Try Again button is clicked', () => {
    const onReset = vi.fn();

    render(
      <ErrorBoundary level="section" onReset={onReset}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    const tryAgainBtn = screen.getByRole('button', { name: /Try Again/i });
    fireEvent.click(tryAgainBtn);

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
