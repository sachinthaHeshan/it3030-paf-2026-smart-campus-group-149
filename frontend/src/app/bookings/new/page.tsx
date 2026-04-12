"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import MainLayout from "@/components/layout/MainLayout";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  Loader2,
  Clock,
  AlertTriangle,
  CalendarDays,
  CheckCircle,
} from "lucide-react";

interface ResourceOption {
  id: number;
  name: string;
  type: string;
  capacity: number | null;
  location: string;
}

interface ScheduleBooking {
  id: number;
  startTime: string;
  endTime: string;
  purpose: string;
  status: string;
  userName: string;
}

const TIMELINE_START = 7;
const TIMELINE_END = 21;
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hasOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(endA) > timeToMinutes(startB);
}

function TimelineBar({
  bookings,
  userStart,
  userEnd,
}: {
  bookings: ScheduleBooking[];
  userStart: string;
  userEnd: string;
}) {
  const totalMinutes = TIMELINE_HOURS * 60;

  const getPosition = (time: string) => {
    const mins = timeToMinutes(time) - TIMELINE_START * 60;
    return Math.max(0, Math.min(100, (mins / totalMinutes) * 100));
  };

  const hours = Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => TIMELINE_START + i);

  const hasUser = userStart && userEnd && userEnd > userStart;
  const userConflict = hasUser && bookings.some((b) =>
    hasOverlap(userStart, userEnd, b.startTime, b.endTime),
  );

  return (
    <div className="mt-1">
      <div className="relative h-10 bg-gray-100 rounded-lg overflow-hidden border border-border">
        {bookings.map((b) => {
          const left = getPosition(b.startTime);
          const right = getPosition(b.endTime);
          const width = right - left;
          const isApproved = b.status === "APPROVED";
          return (
            <div
              key={b.id}
              title={`${b.startTime} - ${b.endTime}: ${b.purpose} (${b.status})`}
              className={`absolute top-1 bottom-1 rounded ${isApproved ? "bg-red-400/80" : "bg-orange-400/70"}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
            />
          );
        })}

        {hasUser && (
          <div
            className={`absolute top-0.5 bottom-0.5 rounded border-2 ${
              userConflict
                ? "border-red-600 bg-red-500/30"
                : "border-green-600 bg-green-500/25"
            }`}
            style={{
              left: `${getPosition(userStart)}%`,
              width: `${Math.max(getPosition(userEnd) - getPosition(userStart), 0.5)}%`,
            }}
          />
        )}
      </div>

      <div className="relative h-4 mt-0.5">
        {hours.map((h) => {
          const pos = ((h - TIMELINE_START) / TIMELINE_HOURS) * 100;
          return (
            <span
              key={h}
              className="absolute text-[9px] text-muted -translate-x-1/2"
              style={{ left: `${pos}%` }}
            >
              {String(h).padStart(2, "0")}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-1 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2.5 rounded bg-red-400/80" />
          Approved
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2.5 rounded bg-orange-400/70" />
          Pending
        </span>
        {hasUser && (
          <span className="flex items-center gap-1">
            <span
              className={`inline-block w-3 h-2.5 rounded border-2 ${
                userConflict ? "border-red-600 bg-red-500/30" : "border-green-600 bg-green-500/25"
              }`}
            />
            Your selection
          </span>
        )}
      </div>
    </div>
  );
}

function NewBookingContent() {
  const router = useRouter();

  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);

  const [resourceId, setResourceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");

  const [schedule, setSchedule] = useState<ScheduleBooking[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ResourceOption[]>("/api/bookings/resources")
      .then(setResources)
      .catch(() => setError("Failed to load resources"))
      .finally(() => setLoadingResources(false));
  }, []);

  const fetchSchedule = useCallback(async (resId: string, date: string) => {
    if (!resId || !date) {
      setSchedule([]);
      return;
    }
    setLoadingSchedule(true);
    try {
      const data = await apiFetch<ScheduleBooking[]>(
        `/api/bookings/schedule?resourceId=${resId}&date=${date}`,
      );
      setSchedule(data || []);
    } catch {
      setSchedule([]);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule(resourceId, bookingDate);
  }, [resourceId, bookingDate, fetchSchedule]);

  const conflict = useMemo(() => {
    if (!startTime || !endTime || endTime <= startTime || schedule.length === 0) return null;
    const conflicting = schedule.find((b) =>
      hasOverlap(startTime, endTime, b.startTime, b.endTime),
    );
    return conflicting || null;
  }, [startTime, endTime, schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!resourceId || !bookingDate || !startTime || !endTime || !purpose.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    if (endTime <= startTime) {
      setError("End time must be after start time");
      return;
    }

    if (conflict) {
      setError("Your selected time conflicts with an existing booking. Please choose a different time.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          resourceId: Number(resourceId),
          bookingDate,
          startTime,
          endTime,
          purpose: purpose.trim(),
          expectedAttendees: expectedAttendees
            ? Number(expectedAttendees)
            : null,
        }),
      });
      router.push("/bookings/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const showSchedulePanel = resourceId && bookingDate;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="New Booking Request"
        subtitle="Reserve a resource for your activity"
        backHref="/bookings/"
      />

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-card-bg border border-border shadow-sm p-6"
      >
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 p-3 text-[13px] text-red-700 flex items-start gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Resource *
            </label>
            {loadingResources ? (
              <div className="flex items-center gap-2 text-[13px] text-muted py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading resources...
              </div>
            ) : (
              <select
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary"
              >
                <option value="">Select a resource...</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.location}
                    {r.capacity ? ` (capacity: ${r.capacity})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Date *
            </label>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Schedule Panel */}
          {showSchedulePanel && (
            <div className="rounded-lg border border-border bg-gray-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={15} className="text-muted" />
                <h3 className="text-[13px] font-semibold text-foreground">
                  Schedule for {new Date(bookingDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                {loadingSchedule && <Loader2 size={13} className="animate-spin text-muted" />}
              </div>

              <TimelineBar
                bookings={schedule}
                userStart={startTime}
                userEnd={endTime}
              />

              {!loadingSchedule && schedule.length === 0 && (
                <div className="flex items-center gap-2 mt-3 text-[12px] text-green-700 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                  <CheckCircle size={14} />
                  No existing bookings on this date. All time slots are available.
                </div>
              )}

              {!loadingSchedule && schedule.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-muted uppercase tracking-wide">
                    Existing bookings ({schedule.length})
                  </p>
                  {schedule.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-3 rounded-lg bg-white border border-border px-3 py-2 text-[12px]"
                    >
                      <Clock size={13} className="text-muted shrink-0" />
                      <span className="font-semibold text-foreground whitespace-nowrap">
                        {b.startTime} - {b.endTime}
                      </span>
                      <span className="text-muted truncate flex-1">{b.purpose}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1">
                Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-foreground mb-1">
                End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Conflict Warning */}
          {conflict && (
            <div className="rounded-lg bg-red-50 border border-red-300 p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-red-800">
                  Time Conflict Detected
                </p>
                <p className="text-[12px] text-red-700 mt-0.5">
                  Your selected time ({startTime} - {endTime}) overlaps with an existing{" "}
                  {conflict.status.toLowerCase()} booking ({conflict.startTime} - {conflict.endTime}).
                  Please choose a different time slot.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Purpose *
            </label>
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Describe the purpose of your booking..."
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">
              Expected Attendees
            </label>
            <input
              type="number"
              min="1"
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
              placeholder="Number of attendees"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-border">
          <a
            href="/bookings/"
            className="rounded-lg border border-border px-5 py-2.5 text-[13px] font-medium text-foreground hover:bg-gray-50 transition-colors"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting || !!conflict}
            className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <MainLayout>
      <NewBookingContent />
    </MainLayout>
  );
}
