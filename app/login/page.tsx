import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">New here? Signing in creates your account.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <LoginForm googleEnabled={process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true"} />
      </Suspense>
    </main>
  );
}
