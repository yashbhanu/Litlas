import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Literary World Map</h1>
      <p className="text-lg text-muted-foreground">
        Read around the world. Log the books you read and see each one pinned at the place its story
        is set.
      </p>
      <div>
        <Link href="/me" className={buttonVariants({ size: "lg" })}>
          Start your shelf
        </Link>
      </div>
    </main>
  );
}
