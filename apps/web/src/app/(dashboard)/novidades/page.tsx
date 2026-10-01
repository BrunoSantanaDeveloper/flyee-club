import NewsView, { type NewsState } from "./news-view";

import { getMemberContext } from "@/lib/member/context";
import { loadNews } from "@/lib/member/news";

/** /novidades: every release and every members' news post, newest first. */
export default async function NewsPage() {
  const context = await getMemberContext();
  let state: NewsState;
  if (!context) {
    state = { kind: "unavailable" };
  } else {
    try {
      state = {
        kind: "ready",
        items: await loadNews(context.supabase, { locale: context.locale, limit: 40 }),
        locale: context.locale,
      };
    } catch {
      state = { kind: "error" };
    }
  }
  return <NewsView state={state} />;
}
