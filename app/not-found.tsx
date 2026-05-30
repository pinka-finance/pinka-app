import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-content py-24 text-center">
      <h1 className="text-display-md font-display font-semibold">404</h1>
      <p className="mt-3 text-inkMuted">Kampanja nije pronađena.</p>
      <Button asChild className="mt-8">
        <Link href="/">Sve kampanje</Link>
      </Button>
    </div>
  );
}
