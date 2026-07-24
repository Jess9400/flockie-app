import Link from "next/link";
import { getTranslations } from "next-intl/server";
import FollowButton from "@/components/FollowButton";

// Compact social strip under the profile hero: posts · following · followers
// (+ Follow button on someone else's profile). Deliberately small — the story
// layout stays Taisiya's.
export default async function ProfileSocialStrip({
  userId,
  isOwner,
  posts,
  following,
  followers,
  viewerFollows,
}: {
  userId: string;
  isOwner: boolean;
  posts: number;
  following: number;
  followers: number;
  viewerFollows?: boolean;
}) {
  const t = await getTranslations("feed.social");
  const stat = (n: number, label: string, href?: string) => {
    const inner = (
      <span className="flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-sm">
        <span className="font-nunito text-base font-extrabold text-navy">{n}</span>
        <span className="text-xs font-bold text-navy/55">{label}</span>
      </span>
    );
    return href ? (
      <Link href={href} className="rounded-full hover:bg-navy/5">
        {inner}
      </Link>
    ) : (
      inner
    );
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 rounded-[2rem] border border-ink/15 bg-white px-2 py-1.5 shadow-[0_2px_10px_rgba(10,37,69,0.05)]">
      {stat(posts, t("posts"))}
      {stat(following, t("following"), isOwner ? "/people?tab=following" : undefined)}
      {stat(followers, t("followers"), isOwner ? "/people?tab=followers" : undefined)}
      <span className="ml-auto pr-1">
        {isOwner ? (
          <Link
            href="/people"
            className="rounded-full bg-flockie-blue px-4 py-2 text-xs font-bold text-white"
          >
            {t("findPeople")}
          </Link>
        ) : (
          <FollowButton userId={userId} initialFollowing={!!viewerFollows} />
        )}
      </span>
    </div>
  );
}
