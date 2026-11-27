type WordmarkProps = {
  href?: string;
  inverse?: boolean;
  first?: string;
  second?: string;
  tagline?: string;
  label?: string;
  className?: string;
};

export default function Wordmark({
  href = "/",
  inverse = false,
  first = "COFFE",
  second = "LOCA",
  tagline = "GOOD COFFEE, GOOD COMPANY",
  label = "Coffe Loca, kembali ke beranda",
  className = "",
}: WordmarkProps) {
  const cls = `wordmark${inverse ? " wordmark-inverse" : ""}${className ? ` ${className}` : ""}`;
  // Default brand: the full COFFEE LOCA logo (light + dark variant, CSS picks one per background)
  if (first === "COFFE" && second === "LOCA") {
    return (
      <a className={`${cls} wordmark-full`} href={href} aria-label={label}>
        <img className="wordmark-full-img wordmark-full-light" src="/loca-logo.webp" alt="" width={640} height={119} />
        <img className="wordmark-full-img wordmark-full-dark" src="/loca-logo-dark.webp" alt="" width={640} height={119} />
      </a>
    );
  }
  return (
    <a className={cls} href={href} aria-label={label}>
      <img className="wordmark-logo" src="/white-coffee-bean.png" alt="" />
      <span className="wordmark-type"><span>{first} <b>{second}</b><em aria-hidden="true">/</em></span><small>{tagline}</small></span>
    </a>
  );
}
