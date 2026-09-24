"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function NavigationIconLink({ href, label, className, children }: { href: string; label: string; className: string; children: ReactNode }) {
  const pathname = usePathname();
  const [navigatingFrom, setNavigatingFrom] = useState<string | null>(null);
  const navigating = navigatingFrom === pathname;

  return (
    <Link href={href} className={className} aria-label={label} title={label} aria-busy={navigating}
      onNavigate={() => setNavigatingFrom(pathname)}>
      {navigating ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : children}
    </Link>
  );
}
