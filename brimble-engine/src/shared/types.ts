import type { ValidationError } from "express-validator";

export type CustomError = Error & {
  statusCode?: number;
  data?: ValidationError[];
};

export interface CaddyRoute {
  match?: Array<{
    host?: string[];
  }>;
  handle?: Array<{
    handler: string;
    upstreams?: Array<{ dial: string }>;
  }>;
  terminal?: boolean;
}