"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CronJob, CronScheduleType, SessionTarget, DeliveryMode, PayloadKind } from "./types";
import { getCronPresets, getIntervalPresets, validateCronExpression } from "@/lib/cron-utils";

// Form components for react-hook-form
import { FormField as RHFFormField } from "@/components/ui/form-field";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  scheduleType: z.enum(["cron", "every", "at"]),
  cronExpr: z.string().optional(),
  intervalMs: z.number().positive().optional(),
  atTime: z.string().optional(),
  sessionTarget: z.enum(["main", "isolated", "current"]),
  payloadKind: z.enum(["systemEvent", "agentTurn"]),
  payloadText: z.string().optional(),
  payloadMessage: z.string().optional(),
  payloadModel: z.string().optional(),
  deliveryMode: z.enum(["none", "announce", "webhook"]),
  deliveryChannel: z.string().optional(),
  webhookUrl: z.string().optional(),
  enabled: z.boolean(),
}).refine(
  (data) => {
    if (data.scheduleType === "cron") {
      const validation = validateCronExpression(data.cronExpr || "");
      return validation.valid;
    }
    return true;
  },
  {
    message: "Invalid cron expression",
    path: ["cronExpr"],
  },
).refine(
  (data) => {
    if (data.scheduleType === "every") {
      return data.intervalMs && data.intervalMs > 0;
    }
    return true;
  },
  {
    message: "Interval must be greater than 0",
    path: ["intervalMs"],
  },
).refine(
  (data) => {
    if (data.scheduleType === "at") {
      return data.atTime && new Date(data.atTime).getTime() > Date.now();
    }
    return true;
  },
  {
    message: "Must be a future timestamp",
    path: ["atTime"],
  },
).refine(
  (data) => {
    if (data.payloadKind === "systemEvent") {
      return data.payloadText && data.payloadText.trim().length > 0;
    }
    if (data.payloadKind === "agentTurn") {
      return data.payloadMessage && data.payloadMessage.trim().length > 0;
    }
    return true;
  },
  {
    message: "Payload content is required",
    path: ["payloadText"],
  },
).refine(
  (data) => {
    if (data.deliveryMode === "webhook") {
      try {
        new URL(data.webhookUrl || "");
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: "Invalid webhook URL",
    path: ["webhookUrl"],
  },
);

type FormData = z.infer<typeof formSchema>;

interface CronJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: CronJob | null;
  onSave: (job: Partial<CronJob>) => Promise<void>;
  isSaving: boolean;
}

export function CronJobDialog({ open, onOpenChange, job, onSave, isSaving }: CronJobDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [selectedIntervalPreset, setSelectedIntervalPreset] = useState<string>("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      scheduleType: "cron",
      cronExpr: "* * * * *",
      intervalMs: 60000,
      atTime: "",
      sessionTarget: "isolated",
      payloadKind: "agentTurn",
      payloadText: "",
      payloadMessage: "",
      payloadModel: "",
      deliveryMode: "none",
      deliveryChannel: "",
      webhookUrl: "",
      enabled: true,
    },
  });

  useEffect(() => {
    if (job) {
      form.reset({
        name: job.name || "",
        scheduleType: job.schedule.kind,
        cronExpr: job.schedule.expr || "* * * * *",
        intervalMs: job.schedule.everyMs || 60000,
        atTime: job.schedule.at || "",
        sessionTarget: job.sessionTarget || "isolated",
        payloadKind: job.payload.kind,
        payloadText: job.payload.text || "",
        payloadMessage: job.payload.message || "",
        payloadModel: job.payload.model || "",
        deliveryMode: job.delivery?.mode || "none",
        deliveryChannel: job.delivery?.channel || "",
        webhookUrl: job.delivery?.to || "",
        enabled: job.enabled,
      });
    } else {
      form.reset();
    }
  }, [job, open, form]);

  const scheduleType = form.watch("scheduleType");
  const sessionTarget = form.watch("sessionTarget");
  const payloadKind = form.watch("payloadKind");
  const deliveryMode = form.watch("deliveryMode");

  // Update CronJobDialog FormField references to use RHFFormField
  // For now, let's simplify by using the standard Form component

  useEffect(() => {
    // Auto-set payload kind based on session target
    if (sessionTarget === "main") {
      form.setValue("payloadKind", "systemEvent");
    } else {
      form.setValue("payloadKind", "agentTurn");
    }
  }, [sessionTarget, form]);

  const handleSubmit = async (data: FormData) => {
    const jobData: Partial<CronJob> = {
      id: job?.id,
      name: data.name,
      enabled: data.enabled,
      sessionTarget: data.sessionTarget,
      schedule: {
        kind: data.scheduleType,
      },
      payload: {
        kind: data.payloadKind,
      },
      delivery: {
        mode: data.deliveryMode,
      },
    };

    if (data.scheduleType === "cron") {
      jobData.schedule = {
        kind: "cron",
        expr: data.cronExpr,
      };
    } else if (data.scheduleType === "every") {
      jobData.schedule = {
        kind: "every",
        everyMs: data.intervalMs,
      };
    } else if (data.scheduleType === "at") {
      jobData.schedule = {
        kind: "at",
        at: data.atTime,
      };
    }

    if (data.payloadKind === "systemEvent") {
      jobData.payload = {
        kind: "systemEvent",
        text: data.payloadText,
      };
    } else {
      jobData.payload = {
        kind: "agentTurn",
        message: data.payloadMessage,
        model: data.payloadModel || undefined,
      };
    }

    if (data.deliveryMode === "announce") {
      jobData.delivery = {
        mode: "announce",
        channel: data.deliveryChannel || undefined,
      };
    } else if (data.deliveryMode === "webhook") {
      jobData.delivery = {
        mode: "webhook",
        to: data.webhookUrl,
      };
    } else {
      jobData.delivery = {
        mode: "none",
      };
    }

    await onSave(jobData);
    onOpenChange(false);
  };

  const cronPresets = getCronPresets();
  const intervalPresets = getIntervalPresets();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Edit Cron Job" : "Create Cron Job"}</DialogTitle>
          <DialogDescription>
            Configure a cron job to run tasks automatically.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My daily backup job" {...field} />
                    </FormControl>
                    <FormDescription>A descriptive name for this job.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Schedule Type */}
              <FormField
                control={form.control}
                name="scheduleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cron">Cron Expression</SelectItem>
                        <SelectItem value="every">Interval (Every X ms)</SelectItem>
                        <SelectItem value="at">One-time (At timestamp)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cron Expression */}
              {scheduleType === "cron" && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="cronExpr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cron Expression</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="* * * * *"
                            className="font-mono text-sm"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Standard 5-field cron format (minute hour day month weekday)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Label className="text-xs text-text-muted">Presets:</Label>
                    {cronPresets.map((preset) => (
                      <Badge
                        key={preset.expr}
                        variant="outline"
                        className={`cursor-pointer transition-colors ${
                          selectedPreset === preset.expr
                            ? "bg-accent-orange text-white border-accent-orange"
                            : "hover:bg-bg-secondary"
                        }`}
                        onClick={() => {
                          form.setValue("cronExpr", preset.expr);
                          setSelectedPreset(preset.expr);
                        }}
                      >
                        {preset.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Interval */}
              {scheduleType === "every" && (
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="intervalMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval (milliseconds)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="60000"
                            className="font-mono text-sm"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Label className="text-xs text-text-muted">Presets:</Label>
                    {intervalPresets.map((preset) => (
                      <Badge
                        key={preset.ms}
                        variant="outline"
                        className={`cursor-pointer transition-colors ${
                          selectedIntervalPreset === preset.label
                            ? "bg-accent-orange text-white border-accent-orange"
                            : "hover:bg-bg-secondary"
                        }`}
                        onClick={() => {
                          form.setValue("intervalMs", preset.ms);
                          setSelectedIntervalPreset(preset.label);
                        }}
                      >
                        {preset.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* At Time */}
              {scheduleType === "at" && (
                <FormField
                  control={form.control}
                  name="atTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Run At (ISO Timestamp)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        When to run this job (must be in the future)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Session Target */}
              <FormField
                control={form.control}
                name="sessionTarget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session Target</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="main">Main Session</SelectItem>
                        <SelectItem value="isolated">Isolated Session</SelectItem>
                        <SelectItem value="current">Current Session</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {sessionTarget === "main" && "Injects system events into the main session"}
                      {sessionTarget === "isolated" && "Spawns a new isolated session for each run"}
                      {sessionTarget === "current" && "Runs in the current session"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payload */}
              {payloadKind === "systemEvent" && (
                <FormField
                  control={form.control}
                  name="payloadText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Event Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Reminder: Check system status"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Text content to inject as a system event
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {payloadKind === "agentTurn" && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="payloadMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Message</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Generate a daily report of all tasks"
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The prompt/message to send to the agent
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="payloadModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="zai/glm-4.7" {...field} />
                        </FormControl>
                        <FormDescription>
                          Override the default model for this job
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Delivery Mode */}
              <FormField
                control={form.control}
                name="deliveryMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="announce">Announce (chat)</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {deliveryMode === "announce" && (
                <FormField
                  control={form.control}
                  name="deliveryChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Channel (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="general" {...field} />
                      </FormControl>
                      <FormDescription>
                        Target channel for the announcement
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {deliveryMode === "webhook" && (
                <FormField
                  control={form.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/webhook"
                          className="font-mono text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        URL to POST the run result to
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Enabled Toggle */}
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border-default p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enabled</FormLabel>
                      <FormDescription>
                        Whether this job is active and will run on schedule
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : job ? "Update Job" : "Create Job"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
