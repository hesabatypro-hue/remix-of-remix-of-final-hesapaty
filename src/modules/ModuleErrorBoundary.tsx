import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  moduleLabel?: string;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Localized error boundary that isolates a single module's failure
 * from the rest of the app shell.
 */
export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Module] ${this.props.moduleLabel ?? ""} crashed:`, error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold">تعذّر تحميل هذه الشاشة</h2>
            <p className="text-sm text-muted-foreground mt-1">
              حدث خطأ في {this.props.moduleLabel ?? "هذا القسم"}. باقي التطبيق يعمل بشكل طبيعي.
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> إعادة المحاولة
            </Button>
            <Button onClick={() => (window.location.href = "/dashboard")} className="gap-2">
              <Home className="w-4 h-4" /> لوحة التحكم
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
