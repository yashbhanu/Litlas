"use client";

import { CheckIcon, ShareIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Share a reader's public map: the native share sheet, or copy the link. */
export function ShareButton({ username, isPublic }: { username: string; isPublic: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/u/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "My reading map", url });
        return;
      } catch {
        // Cancelled or unavailable: fall back to copying.
      }
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="outline"
      size="icon-lg"
      className="size-11 rounded-xl"
      onClick={share}
      aria-label={copied ? "Link copied" : "Share your reading map"}
      title={
        isPublic ? "Share your reading map" : "Your profile is private: only you can open this link"
      }
    >
      {copied ? <CheckIcon aria-hidden className="text-primary" /> : <ShareIcon aria-hidden />}
    </Button>
  );
}
