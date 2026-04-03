import { LandingPageV1 } from "@/components/landing/rebrand/LandingPageV1";
import { brand } from "@/lib/brand";
import { AuthenticatedDashboard } from "./AuthenticatedDashboard";

/**
 * Homepage: server-renders the landing page so search engines see real content.
 * The AuthenticatedDashboard is a client boundary that swaps in the dashboard
 * when the user is logged in.
 */
export default function HomePage() {
  return (
    <AuthenticatedDashboard>
      <LandingPageV1 brand={brand} />
    </AuthenticatedDashboard>
  );
}
