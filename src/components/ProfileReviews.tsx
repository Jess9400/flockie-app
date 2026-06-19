import Image from "next/image";
import { format } from "date-fns";
import Stars from "@/components/Stars";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewerName: string;
  reviewerPhoto: string | null;
};

export default function ProfileReviews({
  avg,
  count,
  items,
}: {
  avg: number;
  count: number;
  items: ReviewItem[];
}) {
  return (
    <section className="mt-10 font-nunito">
      <div className="flex items-center gap-2">
        <h2 className="font-fredoka text-[22px] font-semibold text-navy">Reviews</h2>
        {count > 0 && (
          <span className="flex items-center gap-1.5 font-nunito text-sm font-semibold text-navy">
            <Stars value={avg} size={15} />
            {avg.toFixed(1)} · {count}
          </span>
        )}
      </div>

      {count === 0 ? (
        <p className="mt-2 font-nunito text-sm font-normal text-navy/60">
          No reviews yet — travel buddies can review each other after a trip.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-2xl border-2 border-navy bg-[#FCF9F4] p-4">
              <div className="flex items-center gap-2">
                {r.reviewerPhoto ? (
                  <Image
                    src={r.reviewerPhoto}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white">
                    {r.reviewerName[0]?.toUpperCase()}
                  </span>
                )}
                <span className="font-nunito text-sm font-bold text-navy">{r.reviewerName}</span>
                <span className="ml-auto font-nunito text-xs font-medium text-navy/50">
                  {format(new Date(r.created_at), "MMM yyyy")}
                </span>
              </div>
              <div className="mt-2">
                <Stars value={r.rating} size={14} />
              </div>
              {r.comment && (
                <p className="mt-1.5 font-nunito text-sm font-normal text-navy/80">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
