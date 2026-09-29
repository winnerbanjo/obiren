import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Single authoritative request validation mechanism for the Obiren API.
 *
 * - Parses with the given Zod schema
 * - Strips unknown keys unless the schema itself calls .strict()
 * - Throws a useful 400 with field-level issues
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    if (value === undefined || value === null || value === '') {
      // Allow empty bodies only for schemas that accept undefined (e.g. all-optional payloads)
      const result = this.schema.safeParse({});
      if (result.success) return result.data;
      throw new BadRequestException({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Request body is required.' },
      });
    }

    // NOTE: no primitive-type rejection here - the same pipe validates both
    // object bodies and scalar route params/query strings. The Zod schema
    // itself is the type authority and will reject mismatched primitives.

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      }));
      throw new BadRequestException({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issues[0]?.message || 'Request validation failed.',
          fields: Object.fromEntries(issues.map((i) => [i.field, i.message])),
        },
      });
    }
    return result.data;
  }
}
