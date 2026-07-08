/**
 * validate.middleware.ts
 * Generic Zod validation middleware factory.
 * Pass a Zod schema and it will validate the request body.
 * On failure, it sends a 422 error with field-level messages.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Format Zod errors into a readable message
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));

      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
      return;
    }

    // Replace req.body with the validated + typed data
    req.body = result.data;
    next();
  };
}
