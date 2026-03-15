"use client";

import { Cloud, Zap, Shield, Globe } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/FadeIn";
import { SystemStatus } from "@/components/SystemStatus";

interface WelcomeScreenProps {
  suggestions: string[];
  onSelect: (query: string) => void;
}

export function WelcomeScreen({ suggestions, onSelect }: WelcomeScreenProps) {
  const features = [
    {
      icon: Cloud,
      title: "Cloud Infrastructure",
      desc: "GCP, AWS, Azure — architecture and deployment",
    },
    {
      icon: Zap,
      title: "Fast Answers",
      desc: "Real-time streamed responses as you watch",
    },
    {
      icon: Shield,
      title: "Best Practices",
      desc: "Security, cost optimisation, and scaling tips",
    },
    {
      icon: Globe,
      title: "Multilingual",
      desc: "English, Swahili, French, and 100+ languages",
    },
  ];

  return (
    <div className="mesh-gradient flex flex-col items-center justify-center py-12">
      <FadeIn>
        <div className="mb-10 text-center">
          <div className="animate-float mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pawa-cyan to-pawa-accent shadow-xl shadow-pawa-cyan/20">
            <Cloud className="h-8 w-8 text-pawa-dark" />
          </div>
          <h2 className="mb-2 font-[var(--font-heading)] text-3xl font-light tracking-tight">
            PawaCloud Assistant
          </h2>
          {/* cyan gradient divider */}
          <div className="mx-auto mb-4 h-px w-16 bg-gradient-to-r from-pawa-cyan to-transparent" />
          <p className="max-w-md text-sm text-[var(--muted-foreground)]">
            Ask about cloud infrastructure, travel documents, Kenyan news, code
            reviews, or anything else on your mind.
          </p>
        </div>
      </FadeIn>

      <Stagger className="mb-10 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {features.map((feat) => (
          <StaggerItem key={feat.title}>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)]/40 p-4 text-center backdrop-blur-sm transition-all hover:border-pawa-cyan/30 hover:shadow-lg hover:shadow-pawa-cyan/5 hover:-translate-y-0.5">
              <feat.icon className="h-5 w-5 text-pawa-cyan" />
              <span className="text-xs font-medium">{feat.title}</span>
              <span className="text-[10px] leading-tight text-[var(--muted-foreground)]">
                {feat.desc}
              </span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <div className="mb-8 flex justify-center">
          <SystemStatus size="sm" showDetails />
        </div>
      </FadeIn>

      <div className="w-full max-w-2xl">
        <p className="eyebrow mb-3 text-center text-[var(--muted-foreground)]/60">
          Try asking
        </p>
        <Stagger className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((s) => (
            <StaggerItem key={s}>
              <button
                onClick={() => onSelect(s)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)]/30 px-4 py-3 text-left text-sm text-[var(--muted-foreground)] transition-all hover:border-pawa-cyan/30 hover:bg-pawa-cyan/5 hover:text-[var(--foreground)]"
              >
                {s}
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
