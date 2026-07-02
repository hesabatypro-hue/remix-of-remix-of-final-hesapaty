import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary — catches rendering errors anywhere in the tree
 * and shows a friendly recovery screen instead of a blank white page.
 *
 * This does NOT catch errors in:
 * - Event handlers (those are caught by try/catch + toast already)
 * - Async code (setTimeout, fetch, promises)
 * - Server-side rendering
 * - Errors thrown in the boundary itself
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console for debugging — in production this could be sent
    // to a monitoring service.
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">حدث خطأ غير متوقع</h1>
              <p className="text-muted-foreground">
                نعتذر عن الإزعاج. حدث خطأ في تحميل هذا الجزء من التطبيق. بياناتك آمنة ولم يتأثر شيء.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                إعادة تحميل الصفحة
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                <Home className="w-4 h-4" />
                العودة للوحة التحكم
              </Button>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <details className="text-right mt-6 p-3 bg-muted rounded-lg text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground mb-2">
                  تفاصيل تقنية (وضع التطوير فقط)
                </summary>
                <pre className="whitespace-pre-wrap break-words text-destructive">
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
