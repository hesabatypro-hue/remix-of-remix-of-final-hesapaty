import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-8xl font-bold text-primary/20">404</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">الصفحة غير موجودة</h1>
          <p className="text-muted-foreground">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to="/dashboard" className="gap-2">
              <Home className="w-4 h-4" />
              لوحة التحكم
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/" className="gap-2">
              <ArrowRight className="w-4 h-4" />
              الصفحة الرئيسية
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
