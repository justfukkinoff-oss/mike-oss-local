"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
    const router = useRouter();

    // Server-side redirect() is incompatible with `output: "export"`;
    // route client-side on mount instead.
    useEffect(() => {
        router.replace("/assistant");
    }, [router]);

    return null;
}
