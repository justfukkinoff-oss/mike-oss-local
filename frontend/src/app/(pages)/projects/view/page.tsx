"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectPage } from "@/app/components/projects/ProjectPage";

export default function ProjectDetailPage() {
    return (
        <Suspense fallback={null}>
            <ProjectDetailInner />
        </Suspense>
    );
}

function ProjectDetailInner() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id") ?? "";
    return <ProjectPage projectId={id} />;
}
