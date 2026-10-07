"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import SiteAlert from "@/components/site/alert";
import SiteButton from "@/components/site/button";
import { SiteTextarea } from "@/components/site/field";
import { isSupabaseConfigured } from "@flyee/auth";
import { createClient } from "@flyee/auth/client";

type CommentRow = {
  id: string;
  authorName: string | null;
  body: string;
  status: string;
  createdAt: string;
};

/**
 * Moderated comment thread under a blog post. RLS shows approved comments
 * to everyone plus the reader's own pending ones; new comments are always
 * created pending and go live from /admin/blog.
 */
export default function BlogComments({ postId }: { postId: string }) {
  const t = useTranslations("marketing");
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const [{ data: rows }, { data: auth }] = await Promise.all([
      supabase
        .from("blog_comments")
        .select("id, author_name, body, status, created_at")
        .eq("post_id", postId)
        .order("created_at"),
      supabase.auth.getUser(),
    ]);
    setComments(
      (rows ?? []).map((row) => ({
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
      })),
    );
    setSignedIn(Boolean(auth.user));
    setUserId(auth.user?.id ?? null);
  }, [postId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    const text = body.trim();
    if (!text || !userId) return;
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("blog_comments")
      .insert({ post_id: postId, user_id: userId, body: text });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    setSubmitted(true);
    refresh();
  };

  if (!isSupabaseConfigured) return null;

  return (
    <div className="mx-auto flex w-full max-w-prose flex-col gap-5">
      <h2 className="font-display text-text-primary text-xl font-normal">{t("blog-comments-title")}</h2>

      {comments.length === 0 && <p className="text-text-secondary text-base">{t("blog-comments-empty")}</p>}

      {comments.map((comment) => (
        <div key={comment.id} className="flex flex-row items-start gap-3">
          <span
            aria-hidden
            className="bg-grey-300 text-background flex h-9 w-9 flex-none items-center justify-center rounded-md text-sm font-semibold"
          >
            {(comment.authorName ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              {comment.authorName ? <span className="text-base font-semibold">{comment.authorName}</span> : null}
              <span className="text-text-secondary text-sm">{new Date(comment.createdAt).toLocaleDateString()}</span>
              {comment.status === "pending" && (
                <span className="text-text-primary outline-warning rounded-sm px-2 py-0.5 text-sm font-medium outline-1 -outline-offset-1">
                  {t("blog-comment-pending-badge")}
                </span>
              )}
            </div>
            <p className="text-text-secondary m-0 text-base leading-6">{comment.body}</p>
          </div>
        </div>
      ))}

      {submitted && (
        <SiteAlert severity="success" neutral>
          {t("blog-comment-pending")}
        </SiteAlert>
      )}
      {error && (
        <SiteAlert severity="error" neutral>
          {error}
        </SiteAlert>
      )}

      {signedIn ? (
        <div className="flex flex-col gap-3">
          <SiteTextarea
            rows={3}
            placeholder={t("blog-comment-placeholder")}
            aria-label={t("blog-comment-placeholder")}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div>
            <SiteButton variant="contained" size="small" onClick={submit} disabled={!body.trim()}>
              {t("blog-comment-submit")}
            </SiteButton>
          </div>
        </div>
      ) : (
        <div>
          <SiteButton variant="outlined" size="small" href="/auth/sign-in">
            {t("blog-comments-signin")}
          </SiteButton>
        </div>
      )}
    </div>
  );
}
