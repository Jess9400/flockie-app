"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type BehaviorEvent =
  | "card_impression"
  | "detail_open"
  | "detail_dwell_10s"
  | "detail_dwell_30s";

type BehaviorSource = "home" | "browse" | "detail";

function recordBehavior(vibeId: string, event: BehaviorEvent, source: BehaviorSource) {
  const supabase = createClient();
  void supabase.rpc("record_vibe_behavior", {
    p_vibe: vibeId,
    p_event: event,
    p_source: source,
  });
}

export function useVibeCardImpression(
  vibeId: string,
  source: Exclude<BehaviorSource, "detail">,
  enabled = true
) {
  const elementRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled || sentRef.current) return;

    let impressionTimer: number | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (impressionTimer !== null) return;
          impressionTimer = window.setTimeout(() => {
            sentRef.current = true;
            recordBehavior(vibeId, "card_impression", source);
            observer.disconnect();
          }, 800);
          return;
        }

        if (impressionTimer !== null) {
          window.clearTimeout(impressionTimer);
          impressionTimer = null;
        }
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      if (impressionTimer !== null) window.clearTimeout(impressionTimer);
    };
  }, [enabled, source, vibeId]);

  return elementRef;
}

export default function VibeDetailBehavior({ vibeId }: { vibeId: string }) {
  const openedRef = useRef(false);
  const sentDwellRef = useRef(new Set<BehaviorEvent>());
  const visibleSinceRef = useRef<number | null>(null);
  const visibleElapsedRef = useRef(0);

  useEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true;
      recordBehavior(vibeId, "detail_open", "detail");
    }

    function startVisibleTimer() {
      if (visibleSinceRef.current === null) {
        visibleSinceRef.current = performance.now();
      }
    }

    function stopVisibleTimer() {
      if (visibleSinceRef.current === null) return;
      visibleElapsedRef.current += performance.now() - visibleSinceRef.current;
      visibleSinceRef.current = null;
    }

    function visibleDuration() {
      return (
        visibleElapsedRef.current +
        (visibleSinceRef.current === null ? 0 : performance.now() - visibleSinceRef.current)
      );
    }

    function sendDwell(event: BehaviorEvent) {
      if (sentDwellRef.current.has(event)) return;
      sentDwellRef.current.add(event);
      recordBehavior(vibeId, event, "detail");
    }

    function checkDwell() {
      const duration = visibleDuration();
      if (duration >= 10_000) sendDwell("detail_dwell_10s");
      if (duration >= 30_000) sendDwell("detail_dwell_30s");
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startVisibleTimer();
      } else {
        stopVisibleTimer();
        checkDwell();
      }
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = window.setInterval(checkDwell, 1_000);

    return () => {
      stopVisibleTimer();
      checkDwell();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [vibeId]);

  return null;
}
