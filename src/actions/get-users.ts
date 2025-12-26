'use server';

import backendAPI from '@/lib/backend-api';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create a safe action client
const actionClient = createSafeActionClient();

// Define the schema for getUsers parameters
const getUsersSchema = z.object({
  pageIndex: z.number().min(0).default(0),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional().default(''),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional()
    .default([]),
});

// Define sort field mapping (for reference, actual sorting is done by Backend API)
const sortFieldMap = {
  name: 'name',
  email: 'email',
  createdAt: 'created_at',
  role: 'role',
  customerId: 'customer_id',
} as const;

// Create a safe action for getting users
export const getUsersAction = actionClient
  .schema(getUsersSchema)
  .action(async ({ parsedInput }) => {
    try {
      const { pageIndex, pageSize, search, sorting } = parsedInput;

      // Get the sort configuration
      const sortConfig = sorting[0];
      const sortField = sortConfig?.id || 'created_at';
      const sortDesc = sortConfig?.desc || false;

      // 通过 Backend API 获取用户列表
      const result = await backendAPI.users.getUsers({
        pageIndex,
        pageSize,
        search: search || undefined,
        sortField,
        sortDesc,
      });

      let items = result.data.items;

      // hide user data in demo website
      if (process.env.NEXT_PUBLIC_DEMO_WEBSITE === 'true') {
        items = items.map((item: any) => ({
          ...item,
          name: 'Demo User',
          email: 'example@mksaas.com',
          customerId: 'cus_abcdef123456',
        }));
      }

      return {
        success: true,
        data: {
          items,
          total: result.data.total,
        },
      };
    } catch (error) {
      console.error('get users error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      };
    }
  });
