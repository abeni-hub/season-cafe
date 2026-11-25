const logoSvg = "/logo.svg";

interface BrandLogoProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
  horizontal?: boolean;
}

export function BrandLogo({
  size = 40,
  showTagline = true,
  className = "",
  horizontal = false,
}: BrandLogoProps) {
  if (horizontal) {
    return (
      <div
        className={`brand-container-horizontal ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "12px",
          textDecoration: "none",
        }}
      >
        <img
          src={logoSvg}
          alt="Seasons Cake Logo"
          width={size}
          height={size}
          style={{ flexShrink: 0, objectFit: "contain" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontSize: `${Math.max(16, size * 0.42)}px`,
              fontWeight: 700,
              color: "var(--brand-spruce, #1E3F33)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            Seasons Cake
          </span>
          {showTagline && (
            <span
              style={{
                fontFamily: "var(--sans, system-ui, sans-serif)",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--brand-terracotta, #C85A32)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: "2px",
              }}
            >
              Delicious &amp; Fresh
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`brand-container-vertical ${className}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "6px",
      }}
    >
      <img
        src={logoSvg}
        alt="Seasons Cake Logo"
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "var(--serif, Georgia, serif)",
            fontSize: `${Math.max(17, size * 0.35)}px`,
            fontWeight: 700,
            color: "var(--brand-spruce, #1E3F33)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          Seasons Cake
        </span>
        {showTagline && (
          <span
            style={{
              fontFamily: "var(--sans, system-ui, sans-serif)",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--brand-terracotta, #C85A32)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            Delicious &amp; Fresh
          </span>
        )}
      </div>
    </div>
  );
}
