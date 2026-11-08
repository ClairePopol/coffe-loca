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
  return (
    <a className={`wordmark${inverse ? " wordmark-inverse" : ""}${className ? ` ${className}` : ""}`} href={href} aria-label={label}>
      <img className="wordmark-logo" src="/white-coffee-bean.png" alt="" />
      <span className="wordmark-type"><span>{first} <b>{second}</b></span><small>{tagline}</small></span>
    </a>
  );
}
