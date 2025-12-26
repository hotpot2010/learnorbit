'use server';

import backendAPI from '@/lib/backend-api';
import { getSession } from '@/lib/server';
import { getUrlWithLocale } from '@/lib/urls/urls';
import { createCustomerPortal } from '@/payment';
import type { CreatePortalParams } from '@/payment/types';
import { getLocale } from 'next-intl/server';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Portal schema for validation
const portalSchema = z.object({
  userId: z.string().min(1, { message: 'User ID is required' }),
  returnUrl: z
    .string()
    .url({ message: 'Return URL must be a valid URL' })
    .optional(),
});

/**
 * Create a customer portal session
 */
export const createPortalAction = actionClient
  .schema(portalSchema)
  .action(async ({ parsedInput }) => {
    const { userId, returnUrl } = parsedInput;

    // Get the current user session for authorization
    const session = await getSession();
    if (!session) {
      console.warn(
        `unauthorized request to create portal session for user ${userId}`
      );
      return {
        success: false,
        error: 'Unauthorized',
      };
    }

    // Only allow users to create their own portal session
    if (session.user.id !== userId) {
      console.warn(
        `current user ${session.user.id} is not authorized to create portal session for user ${userId}`
      );
      return {
        success: false,
        error: 'Not authorized to do this action',
      };
    }

    try {
      // Get the user's customer ID from Backend API
      const userData = await backendAPI.users.getById(session.user.id);

      if (!userData || !userData.customer_id) {
        console.error(`No customer found for user ${session.user.id}`);
        return {
          success: false,
          error: 'No customer found for user',
        };
      }

      // Get the current locale from the request
      const locale = await getLocale();

      // Create the portal session with localized URL if no custom return URL is provided
      const returnUrlWithLocale =
        returnUrl || getUrlWithLocale('/settings/billing', locale);
      const params: CreatePortalParams = {
        customerId: userData.customer_id,
        returnUrl: returnUrlWithLocale,
        locale,
      };

      const result = await createCustomerPortal(params);
      // console.log('create customer portal result:', result);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('create customer portal error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Something went wrong',
      };
    }
  });
