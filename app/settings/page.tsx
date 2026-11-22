import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, getSessionUser } from "@/lib/auth";
import { DeleteAccount } from "./delete-account";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your profile, privacy and account.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings");
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding?next=/settings");

  return (
    <>
      <section
        aria-labelledby="profile-heading"
        className="space-y-5 rounded-2xl border p-5 sm:p-6"
      >
        <div>
          <h2 id="profile-heading" className="text-lg font-semibold">
            Profile
          </h2>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email ?? "your account"}. Your username and display name are always
            visible on your profile page.
          </p>
        </div>
        <ProfileForm profile={profile} />
      </section>
      <DeleteAccount username={profile.username} />
    </>
  );
}
