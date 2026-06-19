"use client";

export function ShareVibeButton({ archetypeName }: { archetypeName: string }) {
  async function handleShare() {
    const shareData = {
      title: "My Flockie vibe",
      text: `I'm ${archetypeName} on Flockie — what's your vibe?`,
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
      return;
    }

    await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
    window.alert("Copied to clipboard!");
  }

  return <button type="button" onClick={handleShare} className="w-full rounded-2xl border-2 border-ink border-b-[5px] bg-navy py-3.5 text-[14.5px] font-extrabold text-white">Share your vibe</button>;
}
