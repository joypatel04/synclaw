import { permanentRedirect } from "next/navigation";

export default function LegacyPublicWssHelpPage() {
  permanentRedirect("/help/public-wss");
}
