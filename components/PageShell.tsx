import type { ReactNode } from "react";
import Wordmark from "@/components/Wordmark";

type PageHeaderProps = {
  backHref?: string;
  backLabel?: string;
  wordmark?: { first?: string; second?: string; tagline?: string };
};

export function PageHeader({ backHref = "/", backLabel = "KEMBALI KE BERANDA", wordmark }: PageHeaderProps) {
  return (
    <header className="page-header">
      <Wordmark {...wordmark} />
      <a className="page-back" href={backHref}>{backLabel} <span className="arrow-icon" aria-hidden="true" /></a>
    </header>
  );
}

export function PageFooter({ items = ["COFFE LOCA · MEDAN", "GOOD COFFEE, GOOD COMPANY", "© 2026"] }: { items?: ReactNode[] }) {
  return (
    <footer className="page-footer">
      {items.map((item, index) => <span key={index}>{item}</span>)}
    </footer>
  );
}
