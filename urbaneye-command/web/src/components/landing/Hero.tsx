import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

interface HeroProps {
  onLoginClick?: () => void;
}

export default function Hero({ onLoginClick }: HeroProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const gridOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.15]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const container: any = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const rise: any = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <section
      ref={ref}
      className="relative min-h-[100svh] overflow-hidden flex flex-col justify-between bg-[#081325] text-white pt-safe"
    >
      {/* Ambient background glow */}
      <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#1E7F73]/25 via-[#2dd4bf]/15 to-transparent blur-[120px] rounded-full pointer-events-none z-0" aria-hidden="true" />

      {/* Top Floating Navigation Header */}
      <header className="relative z-20 mx-auto w-full max-w-6xl px-3.5 sm:px-6 pt-3.5 sm:pt-6 md:px-12 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center space-x-2 sm:space-x-3.5 min-w-0">
          {/* Logo Brandmark Emblem */}
          <div className="relative group shrink-0">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1E7F73] to-[#2dd4bf] rounded-full blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full overflow-hidden bg-[#081325] border border-[#2dd4bf]/40 p-0.5 shadow-md shadow-[#1E7F73]/20">
              <img src="/logo.png" alt="UrbanEye" className="w-full h-full object-cover rounded-full" />
            </div>
          </div>

          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display text-base sm:text-xl font-bold tracking-tight text-white leading-none">
                UrbanEye
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold tracking-wider bg-[#1E7F73]/20 text-[#2dd4bf] border border-[#2dd4bf]/35 shadow-[0_0_10px_rgba(45,212,191,0.15)] uppercase backdrop-blur-md shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] animate-pulse" />
                V1.0 LIVE
              </span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-medium tracking-wider text-slate-400 uppercase mt-0.5 truncate max-w-[160px] xs:max-w-[220px] sm:max-w-none">
              Ministry of Road Transport & Highways
            </span>
          </div>
        </div>

        <nav className="flex items-center space-x-2 sm:space-x-6 text-xs shrink-0">
          <a
            href="#how-it-works"
            className="hidden transition sm:inline font-medium text-slate-300 hover:text-white hover:scale-105"
          >
            How it works
          </a>
          <a
            href="#features"
            className="hidden transition md:inline font-medium text-slate-300 hover:text-white hover:scale-105"
          >
            Features
          </a>
          <a
            href="#impact"
            className="hidden transition md:inline font-medium text-slate-300 hover:text-white hover:scale-105"
          >
            Impact
          </a>

          {/* Officer Login Button (min 44px touch target) */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onLoginClick}
            className="rounded-full bg-gradient-to-r from-[#1E7F73] to-[#166c62] hover:from-[#249588] hover:to-[#1a7f74] px-3.5 sm:px-6 py-2 sm:py-2.5 font-bold text-xs sm:text-sm text-white shadow-lg shadow-[#1E7F73]/30 transition-all border border-[#2dd4bf]/20 flex items-center space-x-1.5 min-h-[40px] sm:min-h-[44px] whitespace-nowrap shrink-0"
            aria-label="Officer Login"
          >
            <span>Officer Login</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </motion.button>
        </nav>
      </header>

      {/* Detection grid background - optimized for mobile GPU */}
      <motion.div
        style={{ opacity: gridOpacity, y: gridY }}
        className="absolute inset-0 pointer-events-none z-0"
        aria-hidden="true"
      >
        <svg className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#1E7F73"
                strokeOpacity={0.18}
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-grid)" />
          {[
            [15, 25], [38, 55], [67, 34], [81, 70], [25, 80], [75, 18],
          ].map(([cx, cy], i) => (
            <circle
              key={i}
              cx={`${cx}%`}
              cy={`${cy}%`}
              r={4}
              fill="#D98E04"
              opacity={0.65}
            />
          ))}
        </svg>
      </motion.div>

      {/* Hero Content with proportionate responsive typography */}
      <motion.div
        style={{ y: contentY }}
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col justify-center px-4 sm:px-6 py-12 sm:py-16 md:px-12 my-auto"
      >
        <motion.div variants={rise} className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-xs sm:text-sm font-semibold tracking-wide flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#1E7F73]/20 border border-[#1E7F73]/40 text-[#2dd4bf] backdrop-blur-md shadow-md shadow-[#1E7F73]/10">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2dd4bf] animate-ping" />
            <span>Bharat Electronics Limited</span>
          </p>
          <span className="hidden sm:inline-flex items-center text-xs px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-700/80 text-slate-300 backdrop-blur-md">
            ● Realtime Edge AI Telemetry Mesh
          </span>
        </motion.div>

        <motion.h1
          variants={rise}
          className="font-display max-w-4xl text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-sm"
        >
          Every Bus Becomes a<br className="hidden sm:inline" /> Mobile Road Sensor.
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-4 sm:mt-6 max-w-5xl text-base sm:text-lg md:text-xl leading-relaxed text-slate-300"
        >
          UrbanEye is an AI-driven road intelligence platform that converts public-transport fleets into distributed mobile sensing networks for automated road-defect detection, geospatial mapping and infrastructure monitoring.
        </motion.p>

        <motion.div variants={rise} className="mt-8 sm:mt-10 flex flex-wrap items-center gap-4 sm:gap-6">
          <motion.a
            whileHover={{ scale: 1.04, boxShadow: "0 20px 25px -5px rgba(30, 127, 115, 0.4)" }}
            whileTap={{ scale: 0.96 }}
            href="#how-it-works"
            className="rounded-full bg-gradient-to-r from-[#1E7F73] to-[#2dd4bf] hover:from-[#166c62] hover:to-[#249588] px-7 sm:px-8 py-3.5 text-xs sm:text-sm font-bold text-white shadow-xl shadow-[#1E7F73]/30 transition-all min-h-[44px] flex items-center justify-center border border-white/20"
          >
            See how it works ↓
          </motion.a>

          <span className="text-xs sm:text-sm font-medium text-slate-400 flex items-center space-x-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
            <span>Zero New Hardware Required</span>
          </span>
        </motion.div>
      </motion.div>

      <div className="h-4 sm:h-6" />
    </section>
  );
}
