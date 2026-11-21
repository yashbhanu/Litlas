"use client";

import { useRouter } from "next/navigation";
import { AddBookFlow } from "@/components/books/add-book-flow";

export function AddBookPageFlow() {
  const router = useRouter();
  return (
    <AddBookFlow
      onAdded={() => {
        router.push("/me");
        router.refresh();
      }}
    />
  );
}
