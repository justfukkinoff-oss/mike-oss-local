"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TRView } from "@/app/components/tabular/TabularReviewView";

export default function ProjectTabularReviewPage() {
    return (
        <Suspense fallback={null}>
            <ProjectTabularReviewInner />
        </Suspense>
    );
}

function ProjectTabularReviewInner() {
    const searchParams = useSearchParams();
    const id = searchParams.get("project") ?? "";
    const reviewId = searchParams.get("reviewId") ?? "";
    return <TRView reviewId={reviewId} projectId={id} />;
}
