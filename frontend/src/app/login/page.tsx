"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand-mark";
import { Illustration } from "@/components/illustration";
import { Sticker } from "@/components/sticker";
import { SiteHeader } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useLocalAuth } from "@/hooks/use-local-auth";
import { WritingText } from "@/components/ui/writing-text";

export default function LoginPage() {
  const router = useRouter();
  const { status, login } = useLocalAuth();

  useEffect(() => {
    if (status === "in") router.replace("/dashboard");
  }, [status, router]);

  if (status !== "out") return null;

  return (
    // The whole page fits one screen: no scrolling, the illustration shrinks with the window height.
    <div className="flex h-dvh flex-col overflow-hidden bg-card dark:bg-background">
        <SiteHeader>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
          </div>
        </SiteHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col justify-center px-6 py-10 sm:px-14">
            <div className="w-full max-w-sm">
              <LogoMark className="mb-6 size-10 rounded-xl" />
              <h1 className="text-2xl font-semibold tracking-[-0.03em]">
                <WritingText text="Log in to StudySync" />
              </h1>
              <p className="mt-1.5 text-muted-foreground">
                Pick up where you left off.
              </p>

              <Button
                onClick={login}
                size="lg"
                className="mt-8 h-10 w-full"
              >
                Log in
              </Button>
            </div>
          </div>

          <div className="dot-grid relative hidden overflow-hidden border-l border-border bg-muted/40 lg:flex lg:flex-col lg:justify-end dark:bg-black/20">
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 pt-10">
              {/* sized by the space left over, keeping the drawing's proportions */}
              <div className="relative aspect-[900/792] h-full max-h-[400px] max-w-full">
                <Illustration
                  name="listening-class"
                  alt="A student at a desk with eyes closed, listening, notes crossed out, a laptop recording the lecture"
                  eager
                  sizes="460px"
                />
                <Sticker name="headphones" color="blue" rotate={-10} size={44} float className="absolute top-[4%] left-[6%]" />
                <Sticker name="sparkle" color="yellow" rotate={10} size={32} float delay={1200} className="absolute top-[8%] right-[8%]" />
              </div>
            </div>
            <div className="relative z-10 flex shrink-0 flex-col gap-5 px-12 pt-8 pb-12">
              <span className="inline-flex h-7 w-fit items-center gap-2 rounded-full border border-border bg-card px-3 text-[13px] text-muted-foreground shadow-xs dark:bg-white/[0.03]">
                <span className="size-1.5 rounded-full bg-highlight" />
                StudySync
              </span>
              <h2 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.05em]">
                <WritingText
                  text={"Stop writing.\nStart listening."}
                  speed={40}
                />
              </h2>
              <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
                Record your class, get a live transcript, and a plain-language
                summary when it ends.
              </p>
              <Button
                render={<Link href="/#how-it-works" />}
                nativeButton={false}
                variant="outline"
                size="lg"
                className="w-fit px-4"
              >
                See how it works
              </Button>
            </div>
          </div>
        </div>
    </div>
  );
}
