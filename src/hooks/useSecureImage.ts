import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSecureImage() {
  const [loading, setLoading] = useState(false);

  const getSecureImageUrl = useCallback(async (transferId: string): Promise<string | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("secure-image", {
        body: { transferId },
      });

      if (error) {
        console.error("Secure image error:", error);
        return null;
      }

      return data?.url || null;
    } catch (err) {
      console.error("Secure image fetch error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getSecureImageUrl, loading };
}
