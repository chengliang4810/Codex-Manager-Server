"use client";

import { useEffect } from "react";

export default function LogoutFallbackPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      正在返回首页...
    </div>
  );
}
