"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TRView } from "@/app/components/tabular/TabularReviewView";

export default function TabularReviewPage() {
    return (
        <Suspense fallback={null}>
            <TabularReviewInner />
        </Suspense>
    );
}

function TabularReviewInner() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id") ?? "";
    return <TRView reviewId={id} />;
}
