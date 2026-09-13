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
};
