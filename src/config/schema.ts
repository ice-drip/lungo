import { z } from "zod";

export const ForwardSchema = z.object({
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  forwardHost: z.string().default("127.0.0.1"),
  forwardPort: z.number().default(0),
});

export const NotifySchema = z.object({
  url: z.string(),
  method: z.enum(["POST", "GET"]).default("POST"),
  headers: z.record(z.string(), z.string()).optional(),
});

export const BackupSchema = z.object({
  enabled: z.boolean().default(true),
  keep: z.number().default(10),
});

export const ConfigSchema = z.object({
  serverDir: z.string(),
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  password: z.string().optional(),
  project: z.string(),
  dist: z.string().default("dist"),

  timeout: z.number().optional(),
  forward: ForwardSchema.optional(),

  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  preDeploy: z.string().optional(),
  postDeploy: z.string().optional(),
  notify: NotifySchema.optional(),
  backup: BackupSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
