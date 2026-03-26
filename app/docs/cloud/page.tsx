import { permanentRedirect } from "next/navigation";

export default function LegacyPublicWssDocsPage() {
  permanentRedirect("/docs/public-wss");
}
