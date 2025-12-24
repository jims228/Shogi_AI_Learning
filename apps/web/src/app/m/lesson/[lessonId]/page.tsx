import { redirect } from "next/navigation";
import { LESSONS } from "@/constants";

export default function MobileLessonEntryPage({
  params,
}: {
  params: { lessonId: string };
}) {
  const lessonId = params.lessonId;
  const lesson = LESSONS.find((l) => l.id === lessonId);

  if (!lesson || !lesson.href) {
    return (
      <div className="min-h-[100svh] bg-white text-slate-900 p-6">
        <h1 className="text-xl font-bold">Lesson not found</h1>
        <p className="mt-2 text-slate-700">lessonId: {lessonId}</p>
      </div>
    );
  }

  const baseHref = lesson.href;
  const join = baseHref.includes("?") ? "&" : "?";
  const mobile = "mobile=1";
  const noai = "noai=1";
  const lid = `lid=${encodeURIComponent(lessonId)}`;
  const next = `${baseHref}${join}${mobile}&${noai}&${lid}`;

  redirect(next);
}


