import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// API Keys schema
const apiKeysSchema = z.object({
  rechargeApiUsername: z.string().min(1, 'Recharge API username is required'),
  rechargeApiToken: z.string().min(1, 'Recharge API token is required'),
  rechargeApiUrl: z.string().min(1, 'Recharge API URL is required'),
  whatsappApiKey: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
});

export default function Settings() {
  const [activeTab, setActiveTab] = useState('apiKeys');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({
    rechargeApiUsername: false,
    rechargeApiToken: false,
    rechargeApiUrl: false,
    whatsappApiKey: false,
    whatsappPhoneNumberId: false,
  });
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  // Query to fetch API keys from the server
  const { data: apiKeysData } = useQuery({
    queryKey: ['/api/settings/api-keys'],
    // Only fetch if the tab is 'apiKeys'
    enabled: activeTab === 'apiKeys',
  });

  // Set default values when API data changes
  React.useEffect(() => {
    if (apiKeysData) {
      apiKeysForm.reset({
        rechargeApiUsername: apiKeysData.rechargeApiKey?.username || '501532',
        rechargeApiToken: apiKeysData.rechargeApiKey?.token || '6f8ee7c72c422cc5de182916ba6b38f4',
        rechargeApiUrl: apiKeysData.rechargeApiKey?.url || 'https://myrc.in/v3/recharge/balance',
        whatsappApiKey: apiKeysData.whatsappApiKey || '',
        whatsappPhoneNumberId: apiKeysData.whatsappPhoneNumberId || '',
      });
    }
  }, [apiKeysData]);
  
  // API Keys form
  const apiKeysForm = useForm<z.infer<typeof apiKeysSchema>>({
    resolver: zodResolver(apiKeysSchema),
    defaultValues: {
      rechargeApiUsername: '501532',
      rechargeApiToken: '6f8ee7c72c422cc5de182916ba6b38f4',
      rechargeApiUrl: 'https://myrc.in/v3/recharge/balance',
      whatsappApiKey: '',
      whatsappPhoneNumberId: '',
    },
  });

  // Toggle showing/hiding password
  const toggleShowSecret = (field: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string | undefined, field: string) => {
    try {
      if (text === undefined) return;
      
      await navigator.clipboard.writeText(text);
      setCopied({
        ...copied,
        [field]: true
      });
      
      // Reset copied status after 2 seconds
      setTimeout(() => {
        setCopied(prev => ({
          ...prev,
          [field]: false
        }));
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Save API Keys mutation
  const saveApiKeysMutation = useMutation({
    mutationFn: async (data: z.infer<typeof apiKeysSchema>) => {
      const response = await apiRequest('POST', '/api/settings/api-keys', data);
      return response.json();
    },
    onSuccess: () => {
      toast.success('API keys have been updated successfully.');
    },
    onError: (error) => {
      toast.error(`Failed to save API keys: ${error.message}`);
    },
  });

  // Handle form submissions
  const onSaveApiKeys = (data: z.infer<typeof apiKeysSchema>) => {
    saveApiKeysMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-inter font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your application settings</p>
      </div>

      <Tabs defaultValue="apiKeys" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="apiKeys">API Keys</TabsTrigger>
        </TabsList>

        {/* API Keys Settings */}
        <TabsContent value="apiKeys">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your API keys and integration credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...apiKeysForm}>
                <form onSubmit={apiKeysForm.handleSubmit(onSaveApiKeys)} className="space-y-6">
                  <div className="border rounded-lg p-4 mb-6 bg-slate-50">
                    <h3 className="text-md font-medium mb-4">Recharge API Keys</h3>
                    <div className="space-y-4">
                      {/* Recharge API Username */}
                      <FormField
                        control={apiKeysForm.control}
                        name="rechargeApiUsername"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recharge API Username</FormLabel>
                            <div className="flex">
                              <FormControl>
                                <div className="relative flex-1">
                                  <Input
                                    type={showSecrets.rechargeApiUsername ? 'text' : 'password'}
                                    {...field}
                                    className="pr-20"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleShowSecret('rechargeApiUsername')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                      {showSecrets.rechargeApiUsername ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, 'rechargeApiUsername')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                                    >
                                      {copied.rechargeApiUsername ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              Your username for the Recharge API
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Recharge API Token */}
                      <FormField
                        control={apiKeysForm.control}
                        name="rechargeApiToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recharge API Token</FormLabel>
                            <div className="flex">
                              <FormControl>
                                <div className="relative flex-1">
                                  <Input
                                    type={showSecrets.rechargeApiToken ? 'text' : 'password'}
                                    {...field}
                                    className="pr-20"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleShowSecret('rechargeApiToken')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                      {showSecrets.rechargeApiToken ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, 'rechargeApiToken')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                                    >
                                      {copied.rechargeApiToken ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              Your authentication token for the Recharge API
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Recharge API URL */}
                      <FormField
                        control={apiKeysForm.control}
                        name="rechargeApiUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Recharge API URL</FormLabel>
                            <div className="flex">
                              <FormControl>
                                <div className="relative flex-1">
                                  <Input
                                    type={showSecrets.rechargeApiUrl ? 'text' : 'password'}
                                    {...field}
                                    className="pr-20"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleShowSecret('rechargeApiUrl')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                      {showSecrets.rechargeApiUrl ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, 'rechargeApiUrl')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                                    >
                                      {copied.rechargeApiUrl ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              The API endpoint URL for the Recharge service
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 mb-6 bg-slate-50">
                    <h3 className="text-md font-medium mb-4">WhatsApp API Integration</h3>
                    <div className="space-y-4">
                      <FormField
                        control={apiKeysForm.control}
                        name="whatsappApiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp API Key</FormLabel>
                            <div className="flex">
                              <FormControl>
                                <div className="relative flex-1">
                                  <Input
                                    type={showSecrets.whatsappApiKey ? 'text' : 'password'}
                                    {...field}
                                    className="pr-20"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleShowSecret('whatsappApiKey')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                                    >
                                      {showSecrets.whatsappApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, 'whatsappApiKey')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                                    >
                                      {copied.whatsappApiKey ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              Meta WhatsApp Business API key for sending notifications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={apiKeysForm.control}
                        name="whatsappPhoneNumberId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp Phone Number ID</FormLabel>
                            <div className="flex">
                              <FormControl>
                                <div className="relative flex-1">
                                  <Input
                                    {...field}
                                    className="pr-20"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(field.value, 'whatsappPhoneNumberId')}
                                      className="text-gray-500 hover:text-gray-700 focus:outline-none ml-2"
                                    >
                                      {copied.whatsappPhoneNumberId ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                                    </button>
                                  </div>
                                </div>
                              </FormControl>
                            </div>
                            <FormDescription>
                              Your WhatsApp Business Phone Number ID
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-medium">API Keys Security</h3>
                        <p className="text-sm text-gray-500">Keep your API keys secure and rotate them regularly</p>
                      </div>
                      <Button variant="outline" type="button">Regenerate Keys</Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="mt-6"
                    disabled={saveApiKeysMutation.isPending}
                  >
                    {saveApiKeysMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}