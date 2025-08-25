"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Schedule } from "@/lib/db";
import React from "react";

export interface ScheduleSelectProps {
  id?: string;
  value: Schedule;
  onChange: (value: Schedule) => void;
  placeholder?: string;
  className?: string;
  noneLabel?: string;
}

const SCHEDULE_OPTIONS: Array<{ value: Schedule; label: string }> = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function ScheduleSelect({ id = "schedule", value, onChange, placeholder = "Select schedule", className, noneLabel }: ScheduleSelectProps) {
  return (
    <Select value={value} onValueChange={(v: Schedule) => onChange(v)}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {SCHEDULE_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.value === 'none' && noneLabel ? noneLabel : opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const scheduleOptions = SCHEDULE_OPTIONS;
