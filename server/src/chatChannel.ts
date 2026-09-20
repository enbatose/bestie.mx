export type ChatQuickReply = { title: string; payload: string };

export type ChatListingCard = {
  title: string;
  subtitle: string;
  url: string;
  imageUrl?: string;
};

export type ChatSink = {
  sendText: (text: string) => Promise<void>;
  sendQuickReplies: (text: string, replies: ChatQuickReply[]) => Promise<void>;
  sendListingCards: (cards: ChatListingCard[], footer: string) => Promise<void>;
  sendImage?: (opts: { url: string; caption?: string }) => Promise<void>;
  /** Native WhatsApp CTA that opens a URL in one tap (Cloud API `cta_url`). */
  sendCtaUrl?: (opts: { body: string; buttonText: string; url: string }) => Promise<void>;
};
