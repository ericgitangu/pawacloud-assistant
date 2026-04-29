// SPDX-License-Identifier: MIT
import { toast as sonner } from "sonner";

import { haptics } from "@/lib/haptics";

export const toast = {
  success: (message: string) => {
    haptics.success();
    sonner.success(message);
  },
  error: (message: string) => {
    haptics.error();
    sonner.error(message);
  },
  warn: (message: string) => {
    haptics.warn();
    sonner.warning(message);
  },
  info: (message: string) => {
    haptics.tap();
    sonner.info(message);
  },
};
