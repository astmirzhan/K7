import { unstable_rethrow } from 'next/navigation';
import type { ZodType } from 'zod';
import { AppError, toErrorResponse } from './errors';

export interface RouteCtx<P> {
  params: Promise<P>;
}

/** Wraps a route handler: JSON out, every error as { error: { code, message } } with the right status. */
export function route<P = Record<string, never>>(
  handler: (req: Request, ctx: RouteCtx<P>) => Promise<unknown>,
) {
  return async (req: Request, ctx: RouteCtx<P>): Promise<Response> => {
    try {
      const data = await handler(req, ctx);
      return Response.json(data ?? { ok: true });
    } catch (e) {
      unstable_rethrow(e); // Next.js control-flow errors (prerender bail-out, redirects) are not API errors
      const { status, body } = toErrorResponse(e);
      return Response.json(body, { status });
    }
  };
}

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new AppError('VALIDATION', undefined, {
      details: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError('VALIDATION', 'Body must be valid JSON');
  }
  return parseWith(schema, raw);
}

export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  return parseWith(schema, Object.fromEntries(new URL(req.url).searchParams));
}
