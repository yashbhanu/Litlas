export function SiteFooter() {
  return (
    <footer className="border-t text-sm text-muted-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        Book data and covers from{" "}
        <a className="underline underline-offset-4" href="https://openlibrary.org">
          Open Library
        </a>
        .
      </div>
    </footer>
  );
}
