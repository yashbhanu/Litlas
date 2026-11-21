export function SiteFooter() {
  return (
    <footer className="border-t bg-surface text-xs text-muted-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
        Book data and covers from{" "}
        <a className="underline underline-offset-4" href="https://openlibrary.org">
          Open Library
        </a>
        . Book settings from{" "}
        <a className="underline underline-offset-4" href="https://www.wikidata.org">
          Wikidata
        </a>{" "}
        (CC0). Map data ©{" "}
        <a className="underline underline-offset-4" href="https://www.openstreetmap.org/copyright">
          OpenStreetMap
        </a>{" "}
        contributors, tiles by{" "}
        <a className="underline underline-offset-4" href="https://openfreemap.org">
          OpenFreeMap
        </a>
        .
      </div>
    </footer>
  );
}
