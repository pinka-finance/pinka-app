"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/lib/auth";
import { CampaignForm } from "@/components/dashboard/campaign-form";
import { createCampaign, getMyAccountId } from "@/lib/dashboard";

export default function NewCampaignPage() {
  return (
    <AuthGate>
      <NewInner />
    </AuthGate>
  );
}

function NewInner() {
  const router = useRouter();
  return (
    <div className="container-content max-w-2xl py-12">
      <Link href="/dashboard" className="text-sm text-inkMuted hover:text-ink">
        ← Natrag
      </Link>
      <h1 className="mt-3 text-display-md font-display font-semibold">
        Nova kampanja
      </h1>
      <p className="mt-2 text-sm text-inkMuted">
        Kampanja se kreira kao <strong>nacrt</strong>. Aktiviraj je kad je spremna.
      </p>

      <div className="mt-8 card-base">
        <CampaignForm
          submitLabel="Kreiraj kampanju"
          onSubmit={async (v) => {
            const accountId = await getMyAccountId();
            if (!accountId) throw new Error("no_account");
            const id = await createCampaign({
              accountId,
              title: v.title,
              type: v.type,
              description: v.description,
              goalCents: v.goalCents,
              minContributionCents: v.minContributionCents,
              destinationAddress: v.destinationAddress,
              subjectType: v.subjectType,
              subjectRef: v.subjectRef,
              visibility: v.visibility,
            });
            router.push(`/dashboard/c/${id}`);
          }}
        />
      </div>
    </div>
  );
}
