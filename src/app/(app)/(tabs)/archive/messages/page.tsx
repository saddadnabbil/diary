import { InstagramMessages } from "@/components/instagram-messages";
import { getDemoInbox } from "@/lib/server/instagram-archive";

export default function ArchiveMessagesPage() {
  return <InstagramMessages inbox={getDemoInbox()} />;
}
