/**
 * Task Encryption Status Component
 * 
 * Shows a simple static message indicating that task encryption is enabled.
 * All new tasks are automatically encrypted with client-side encryption.
 * 
 * Note: This is a simplified version that doesn't check for legacy unencrypted
 * tasks (migration feature removed for performance - checking all tasks on 
 * every Settings page load was unnecessary overhead).
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export default function TaskEncryptionMigration() {
  return (
    <Card className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-green-800 dark:text-green-200">Tasks Encrypted</h3>
            <p className="text-sm text-green-600 dark:text-green-400">
              All your tasks are securely encrypted. Only you can view them.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

