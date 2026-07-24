"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Heart, MessageCircle, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatChatTime } from "@/lib/chat";

export type FeedPost = {
  id: string;
  author_id: string;
  author_name: string | null;
  author_photo: string | null;
  kind: "vibe" | "club" | "activity";
  anchor_title: string;
  vibe_id: string | null;
  club_id: string | null;
  activity_id: string | null;
  body: string;
  photos: string[];
  city: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

type Comment = { id: string; author_id: string; body: string; created_at: string; name: string; photo: string | null };

const ANCHOR_STYLE: Record<string, string> = {
  vibe: "bg-flockie-coral/10 text-flockie-coral",
  club: "bg-flockie-blue/10 text-flockie-blue",
  activity: "bg-onboarding-green/10 text-onboarding-green",
};
const ANCHOR_EMOJI: Record<string, string> = { vibe: "🎉", club: "🔁", activity: "🤝" };

function anchorHref(p: FeedPost): string | null {
  if (p.kind === "vibe" && p.vibe_id) return `/vibes/${p.vibe_id}`;
  if (p.kind === "club" && p.club_id) return `/clubs/${p.club_id}`;
  return null; // 1:1 activities have no public page
}

// The city feed: recaps of real vibes / clubs / activities. Likes + comments
// inline; posting lives at /posts/new (the teaser bar links there).
export default function FeedSection({
  posts: initial,
  meId,
  mePhoto,
  composer = true,
}: {
  posts: FeedPost[];
  meId: string;
  mePhoto: string | null;
  composer?: boolean;
}) {
  const supabase = createClient();
  const t = useTranslations("feed");
  const locale = useLocale();
  const [posts, setPosts] = useState(initial);
  const [open, setOpen] = useState<Record<string, Comment[] | "loading">>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function toggleLike(p: FeedPost) {
    // optimistic
    setPosts((cur) =>
      cur.map((x) =>
        x.id === p.id
          ? { ...x, liked_by_me: !x.liked_by_me, like_count: x.like_count + (x.liked_by_me ? -1 : 1) }
          : x
      )
    );
    if (p.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", p.id).eq("user_id", meId);
    } else {
      await supabase.from("post_likes").insert({ post_id: p.id, user_id: meId });
    }
  }

  async function loadComments(postId: string) {
    if (open[postId]) {
      setOpen((cur) => {
        const next = { ...cur };
        delete next[postId];
        return next;
      });
      return;
    }
    setOpen((cur) => ({ ...cur, [postId]: "loading" }));
    const { data: rows } = await supabase
      .from("post_comments")
      .select("id, author_id, body, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.author_id)));
    const profiles: Record<string, { name: string; photo: string | null }> = {};
    if (ids.length) {
      const { data: pp } = await supabase
        .from("public_profiles")
        .select("id, display_name, photos")
        .in("id", ids);
      pp?.forEach((p) => (profiles[p.id] = { name: p.display_name ?? "Flockie", photo: p.photos?.[0] ?? null }));
    }
    setOpen((cur) => ({
      ...cur,
      [postId]: (rows ?? []).map((r) => ({
        ...r,
        name: profiles[r.author_id]?.name ?? "Flockie",
        photo: profiles[r.author_id]?.photo ?? null,
      })),
    }));
  }

  async function deletePost(postId: string) {
    setPosts((cur) => cur.filter((x) => x.id !== postId));
    await supabase.from("posts").delete().eq("id", postId).eq("author_id", meId);
  }

  async function addComment(postId: string) {
    const body = (drafts[postId] ?? "").trim();
    if (!body) return;
    setDrafts((cur) => ({ ...cur, [postId]: "" }));
    const { data } = await supabase.rpc("add_post_comment", { p_post: postId, p_body: body });
    setPosts((cur) => cur.map((x) => (x.id === postId ? { ...x, comment_count: x.comment_count + 1 } : x)));
    setOpen((cur) => {
      const list = cur[postId];
      if (!Array.isArray(list)) return cur;
      return {
        ...cur,
        [postId]: [
          ...list,
          { id: (data as string) ?? `tmp-${Date.now()}`, author_id: meId, body, created_at: new Date().toISOString(), name: t("you"), photo: mePhoto },
        ],
      };
    });
  }

  function avatar(photo: string | null, name: string | null, size: number) {
    return photo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    ) : (
      <span
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-flockie-blue text-xs font-bold text-white"
      >
        {(name ?? "?")[0]?.toUpperCase()}
      </span>
    );
  }

  return (
    <div className="space-y-3">
      {/* composer teaser */}
      {composer && (
      <Link
        href="/posts/new"
        className="flex items-center gap-2.5 rounded-full border border-ink/15 bg-white py-1.5 pl-3 pr-1.5 shadow-[0_2px_10px_rgba(10,37,69,0.08)] transition-transform hover:-translate-y-0.5"
      >
        {avatar(mePhoto, "You", 28)}
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-muted">{t("teaser")}</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-flockie-coral px-4 py-2 text-xs font-bold text-white">
          <Plus size={14} /> {t("post")}
        </span>
      </Link>
      )}

      {posts.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-ink/25 bg-white p-8 text-center">
          <p className="text-3xl">📸</p>
          <p className="mt-2 text-base font-extrabold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm font-medium text-muted">{t("emptyBody")}</p>
        </div>
      )}

      {posts.map((p) => {
        const href = anchorHref(p);
        const chip = (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${ANCHOR_STYLE[p.kind]}`}>
            {ANCHOR_EMOJI[p.kind]} {p.anchor_title}
          </span>
        );
        const comments = open[p.id];
        return (
          <article key={p.id} className="rounded-3xl border border-ink/15 bg-white p-4 shadow-[0_2px_10px_rgba(10,37,69,0.08)]">
            <div className="flex items-center gap-2.5">
              {avatar(p.author_photo, p.author_name, 36)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{p.author_name ?? "Flockie"}</p>
                <p className="text-[11px] font-bold text-muted">
                  {formatChatTime(p.created_at, locale)} · {p.city}
                </p>
              </div>
              {p.author_id === meId && (
                <button
                  type="button"
                  onClick={() => deletePost(p.id)}
                  aria-label={t("deletePost")}
                  className="shrink-0 rounded-full p-1 text-ink/35 hover:bg-cream hover:text-ink"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="mt-2.5">{href ? <Link href={href}>{chip}</Link> : chip}</div>
            {p.body && <p className="mt-2 whitespace-pre-line text-sm font-semibold text-ink">{p.body}</p>}

            {p.photos.length > 0 && (
              <div className={`mt-2.5 grid gap-1 overflow-hidden rounded-2xl ${p.photos.length > 1 ? "grid-cols-2" : ""}`}>
                {p.photos.slice(0, 4).map((url, i) => (
                  <div key={i} className="relative aspect-[16/10] bg-cream">
                    <Image src={url} alt="" fill sizes="(max-width: 640px) 100vw, 600px" className="object-cover" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2.5 flex items-center gap-4 border-t border-ink/10 pt-2.5">
              <button
                type="button"
                onClick={() => toggleLike(p)}
                className={`flex items-center gap-1.5 text-xs font-extrabold ${p.liked_by_me ? "text-flockie-coral" : "text-muted hover:text-ink"}`}
              >
                <Heart size={16} className={p.liked_by_me ? "fill-flockie-coral" : ""} /> {p.like_count}
              </button>
              <button
                type="button"
                onClick={() => loadComments(p.id)}
                className="flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-ink"
              >
                <MessageCircle size={16} /> {p.comment_count}
              </button>
            </div>

            {comments && (
              <div className="mt-2 border-t border-dashed border-ink/10 pt-2">
                {comments === "loading" ? (
                  <p className="py-2 text-center text-xs font-medium text-muted">…</p>
                ) : (
                  <>
                    {comments.map((c) => (
                      <div key={c.id} className="mt-1.5 flex items-start gap-2">
                        {avatar(c.photo, c.name, 24)}
                        <p className="rounded-xl bg-cream px-3 py-1.5 text-xs font-semibold">
                          <span className="mr-1.5 font-extrabold">{c.name}</span>
                          {c.body}
                        </p>
                      </div>
                    ))}
                    <div className="mt-2 flex gap-2">
                      <input
                        value={drafts[p.id] ?? ""}
                        onChange={(e) => setDrafts((cur) => ({ ...cur, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addComment(p.id)}
                        placeholder={t("commentPlaceholder")}
                        maxLength={500}
                        className="h-9 min-w-0 flex-1 rounded-full border border-ink/20 bg-white px-3.5 text-xs font-medium outline-none focus:border-flockie-blue"
                      />
                      <button
                        type="button"
                        onClick={() => addComment(p.id)}
                        disabled={!(drafts[p.id] ?? "").trim()}
                        className="shrink-0 rounded-full bg-flockie-blue px-4 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {t("send")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
