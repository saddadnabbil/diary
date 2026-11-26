import { InstagramArchive } from "@/components/instagram-archive";
import { getDemoArchive } from "@/lib/server/instagram-archive";

export default function ArchivePage() {
  return <InstagramArchive archive={getDemoArchive()} />;
}
