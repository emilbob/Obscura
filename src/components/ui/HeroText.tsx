import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { useViewport } from "../../hooks/useViewport";

const TITLE = "OBSCURA";

interface HeroTextProps {
  delay?: number;
  hide?: boolean;
}

export default function HeroText({ delay = 5.2, hide = false }: HeroTextProps) {
  const vp            = useViewport();
  const containerRef  = useRef<HTMLDivElement>(null);
  const charRefs      = useRef<(HTMLSpanElement | null)[]>([]);
  const subtitleRef   = useRef<HTMLParagraphElement>(null);
  const lineRef       = useRef<HTMLDivElement>(null);
  const wasHiddenRef  = useRef(false);

  useEffect(() => {
    const chars = charRefs.current.filter(Boolean) as HTMLSpanElement[];
    const subtitle = subtitleRef.current;
    const line = lineRef.current;
    if (!chars.length || !subtitle || !line) return;

    // Initial state
    gsap.set(chars, { opacity: 0, y: 28, rotateX: -15 });
    gsap.set(subtitle, { opacity: 0, y: 12 });
    gsap.set(line, { scaleX: 0, transformOrigin: "left center" });

    const tl = gsap.timeline({ delay });

    // Title characters stagger in
    tl.to(chars, {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 1.1,
      stagger: 0.048,
      ease: "power4.out",
    })

      // Separator line draws
      .to(
        line,
        {
          scaleX: 1,
          duration: 0.9,
          ease: "power3.inOut",
        },
        "-=0.5",
      )

      // Subtitle fades up
      .to(
        subtitle,
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          ease: "power3.out",
        },
        "-=0.6",
      );

    return () => {
      tl.kill();
    };
  }, [delay]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (hide) {
      wasHiddenRef.current = true;
      gsap.to(containerRef.current, {
        opacity: 0,
        y: -16,
        duration: 1.8,
        ease: "power2.inOut",
        overwrite: true,
      });
    } else if (wasHiddenRef.current) {
      gsap.to(containerRef.current, {
        opacity: 1,
        y: 0,
        duration: 1.4,
        ease: "power2.out",
        overwrite: true,
      });
    }
  }, [hide]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        bottom: "50%",
        left: "50%",
        transform: "translate(-50%, 50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        // Landscape phones have ~320px of height to spend. Sized on width
        // alone the centred hero rises into the chapter label in the top left,
        // so on short viewports it is driven by height instead.
        gap: vp.isShort ? "0.55rem" : "1.2rem",
        pointerEvents: "none",
        userSelect: "none",
        perspective: "800px",
      }}
    >
      {/* Main title */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 300,
          fontSize: vp.isShort
            ? "clamp(1.6rem, 11vh, 3rem)"
            : "clamp(2.8rem, 8.5vw, 8.5rem)",
          letterSpacing: vp.isShort ? "0.16em" : "0.22em",
          color: "var(--star-white)",
          lineHeight: 1,
          whiteSpace: "nowrap",
          display: "flex",
        }}
      >
        {TITLE.split("").map((char, i) => (
          <span
            key={i}
            ref={(el) => {
              charRefs.current[i] = el;
            }}
            style={{ display: "inline-block" }}
          >
            {char}
          </span>
        ))}
      </h1>

      {/* Separator */}
      <div
        ref={lineRef}
        style={{
          width: "100%",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent, rgba(74,158,255,0.4) 30%, rgba(74,158,255,0.4) 70%, transparent)",
        }}
      />

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: vp.isShort
            ? "clamp(0.7rem, 3vh, 0.95rem)"   // floor keeps it above ~11px
            : "clamp(0.82rem, 1.8vw, 1.4rem)",
          letterSpacing: vp.isShort ? "0.2em" : "0.28em",
          color: "rgba(200, 216, 240, 0.92)",
          textTransform: "uppercase",
        }}
      >
        Mapping the Unknown
      </p>
    </div>
  );
}
