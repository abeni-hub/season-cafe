import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  onOrder: () => void;
  showOrder?: boolean;
}

const links = [
  ["Home", "#home"],
  ["About", "#about"],
  ["Our cakes", "#cakes"],
  ["Gallery", "#gallery"],
  ["Contact", "#contact"],
];

export function Header({ onOrder, showOrder = true }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 12);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.querySelector<HTMLButtonElement>(".menu-toggle")?.focus();
      }
    };
    const closeOnDesktop = () => {
      if (window.innerWidth > 700) setMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const current = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (current) setActiveSection(current.target.id);
    }, { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.1, 0.4] });
    const sections = links
      .map(([, href]) => document.querySelector<HTMLElement>(href))
      .filter((section): section is HTMLElement => section !== null);
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`site-header${isScrolled ? " is-scrolled" : ""}`}>
      <a className="brand" href="#home" aria-label="Seasons Cake home" onClick={closeMenu} style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
        <img src="/src/assets/logo.svg" alt="Seasons Cake" width="38" height="38" style={{ objectFit: "contain", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span className="brand-name" style={{ fontFamily: "var(--serif)", fontSize: "20px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--brand-spruce)", lineHeight: 1.1 }}>Seasons Cake</span>
          <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--brand-terracotta)", textTransform: "uppercase" }}>Delicious &amp; Fresh</span>
        </div>
      </a>
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      <nav
        className={`primary-navigation${menuOpen ? " is-open" : ""}`}
        id="primary-navigation"
        aria-label="Main navigation"
      >
        {links.map(([label, href]) => (
          <a
            href={href}
            key={href}
            aria-current={activeSection === href.slice(1) ? "location" : undefined}
            onClick={() => {
              setActiveSection(href.slice(1));
              closeMenu();
            }}
          >
            {label}
          </a>
        ))}
        {showOrder && <button
          className="button button-dark nav-order"
          type="button"
          onClick={() => {
            closeMenu();
            onOrder();
          }}
        >
          Order your cake
        </button>}
      </nav>
    </header>
  );
}
