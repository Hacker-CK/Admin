
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiRequest } from '../lib/queryClient';

const databaseSettingsSchema = z.object({
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  PGDATABASE: z.string().min(1, 'Database name is required'),
  PGHOST: z.string().min(1, 'Host is required'),
  PGPORT: z.string().min(1, 'Port is required'),
  PGUSER: z.string().min(1, 'Username is required'),
  PGPASSWORD: z.string().min(1, 'Password is required'),
});

export default function DatabaseSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof databaseSettingsSchema>>({
    resolver: zodResolver(databaseSettingsSchema),
    defaultValues: {
      DATABASE_URL: "",
      PGDATABASE: "",
      PGHOST: "",
      PGPORT: "5432", // Default PostgreSQL port
      PGUSER: "",
      PGPASSWORD: "",
    },
  });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await apiRequest('GET', '/api/settings/database/status');
      const data = await response.json();
      setIsConnected(data.isConnected);
      if (data.isConnected && data.config) {
        form.reset(data.config);
      }
    } catch (error) {
      setError('Failed to check database connection status');
      setIsConnected(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof databaseSettingsSchema>) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('POST', '/api/settings/database/connect', data);
      const result = await response.json();
      
      if (result.success) {
        setIsConnected(true);
      } else {
        setError(result.message || 'Failed to connect to database');
      }
    } catch (error) {
      setError('Failed to connect to database');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('POST', '/api/settings/database/disconnect');
      const result = await response.json();

      if (result.success) {
        setIsConnected(false);
        form.reset();
      } else {
        setError(result.message || 'Failed to disconnect from database');
      }
    } catch (error) {
      setError('Failed to disconnect from database');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Database Connection</h3>
        <p className="text-sm text-gray-500">Configure your PostgreSQL database connection settings.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isConnected && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          Connected to database successfully
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Database URL</label>
          <input
            {...form.register('DATABASE_URL')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.DATABASE_URL && (
            <p className="text-red-600 text-sm">{form.formState.errors.DATABASE_URL.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Database Name</label>
          <input
            {...form.register('PGDATABASE')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.PGDATABASE && (
            <p className="text-red-600 text-sm">{form.formState.errors.PGDATABASE.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Host</label>
          <input
            {...form.register('PGHOST')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.PGHOST && (
            <p className="text-red-600 text-sm">{form.formState.errors.PGHOST.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Port</label>
          <input
            {...form.register('PGPORT')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.PGPORT && (
            <p className="text-red-600 text-sm">{form.formState.errors.PGPORT.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Username</label>
          <input
            {...form.register('PGUSER')}
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.PGUSER && (
            <p className="text-red-600 text-sm">{form.formState.errors.PGUSER.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            {...form.register('PGPASSWORD')}
            type="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {form.formState.errors.PGPASSWORD && (
            <p className="text-red-600 text-sm">{form.formState.errors.PGPASSWORD.message}</p>
          )}
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>

          {isConnected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isLoading}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isLoading ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
