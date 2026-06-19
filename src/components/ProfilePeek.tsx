"use client";

import Link from "next/link";

export type PeekData = {
  id: string;
  name: string;
  age: number | null;
  city: string | null;
  photos: string[];
  oneLiner: string | null;
  answers: { label: string; answer: string }[];
  tripVibe: string[];
  travelStyle: string[];
};

export default function ProfilePeek({
  data,
  onClose,
}: {
  data: PeekData;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-navy/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t-2 border-navy bg-cream p-5 font-nunito">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy/20" />

        {/* Photo carousel */}
        {data.photos.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {data.photos.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-48 w-40 shrink-0 rounded-2xl object-cover"
              />
            ))}
          </div>
        )}

        <p className="mt-4 font-fredoka text-2xl font-bold text-navy">
          {data.name}
          {data.age ? `, ${data.age}` : ""}
        </p>
        {data.city && <p className="font-nunito text-sm font-medium text-navy/70">📍 {data.city}</p>}

        {data.oneLiner && (
          <p className="mt-3 font-fredoka text-lg font-medium italic text-navy">
            &ldquo;{data.oneLiner}&rdquo;
          </p>
        )}

        {data.answers.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {data.answers.map((a) => (
              <p key={a.label} className="font-nunito text-sm text-navy">
                <span className="font-semibold">{a.label}: </span>
                <span className="text-navy/70">{a.answer}</span>
              </p>
            ))}
          </div>
        )}

        {(data.tripVibe.length > 0 || data.travelStyle.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {[...data.tripVibe, ...data.travelStyle].map((t) => (
              <span
                key={t}
                className="rounded-full bg-flockie-coral px-3 py-1.5 font-nunito text-xs font-semibold text-white"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Link
            href={`/people/${data.id}`}
            className="flex-1 rounded-full border-2 border-navy bg-flockie-blue py-2.5 text-center font-fredoka text-sm font-semibold text-white"
          >
            View full profile
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-navy bg-white px-5 font-fredoka text-sm font-semibold text-navy"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
