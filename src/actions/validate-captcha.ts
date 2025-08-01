'use server';

import { validateTurnstileToken } from '@/lib/captcha';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Captcha validation schema
const captchaSchema = z.object({
  captchaToken: z.string().min(1, { message: 'Captcha token is required' }),
});

// Create a safe action for captcha validation
export const validateCaptchaAction = actionClient
  .schema(captchaSchema)
  .action(async ({ parsedInput }) => {
    const { captchaToken } = parsedInput;

    try {
      const isValid = await validateTurnstileToken(captchaToken);

      return {
        success: true,
        valid: isValid,
      };
    } catch (error) {
      console.error('Captcha validation error:', error);
      return {
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
