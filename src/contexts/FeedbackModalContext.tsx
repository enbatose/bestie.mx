import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";
import {
  FEEDBACK_OPEN_EVENT,
  type FeedbackOpenDetail,
  type FeedbackViewedListing,
} from "@/lib/feedbackSession";
import type { FeedbackSource } from "@/lib/messagesApi";

type FeedbackModalContextValue = {
  openFeedback: (detail?: Partial<FeedbackOpenDetail> & { source?: FeedbackSource }) => void;
  closeFeedback: () => void;
  /** True briefly when search-triggered feedback opens — map FAB should flash. */
  flashMapFab: boolean;
};

const FeedbackModalContext = createContext<FeedbackModalContextValue | null>(null);

const DEFAULT_DETAIL: FeedbackOpenDetail = { source: "menu" };

export function FeedbackModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<FeedbackOpenDetail>(DEFAULT_DETAIL);
  const [flashMapFab, setFlashMapFab] = useState(false);

  const openFeedback = useCallback((next?: Partial<FeedbackOpenDetail> & { source?: FeedbackSource }) => {
    const merged: FeedbackOpenDetail = {
      source: next?.source ?? "menu",
      publishedRoomId: next?.publishedRoomId,
      publishedTitle: next?.publishedTitle,
      viewedListings: next?.viewedListings as FeedbackViewedListing[] | undefined,
      flashMapFab: next?.flashMapFab,
    };
    setDetail(merged);
    setOpen(true);
    if (merged.flashMapFab) {
      setFlashMapFab(true);
      window.setTimeout(() => setFlashMapFab(false), 2800);
    }
  }, []);

  const closeFeedback = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const onOpen = (ev: Event) => {
      const d = (ev as CustomEvent<FeedbackOpenDetail>).detail;
      openFeedback(d ?? { source: "menu" });
    };
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen);
  }, [openFeedback]);

  const value = useMemo(
    () => ({ openFeedback, closeFeedback, flashMapFab }),
    [openFeedback, closeFeedback, flashMapFab],
  );

  return (
    <FeedbackModalContext.Provider value={value}>
      {children}
      <FeedbackModal
        open={open}
        onClose={closeFeedback}
        source={detail.source}
        publishedRoomId={detail.publishedRoomId}
        publishedTitle={detail.publishedTitle}
        viewedListings={detail.viewedListings}
      />
    </FeedbackModalContext.Provider>
  );
}

export function useFeedbackModal(): FeedbackModalContextValue {
  const ctx = useContext(FeedbackModalContext);
  if (!ctx) throw new Error("useFeedbackModal must be used within FeedbackModalProvider");
  return ctx;
}
