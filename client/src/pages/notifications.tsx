import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Notification, insertNotificationSchema, User } from '@shared/schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { getInitials } from '@/lib/utils';
import { Search, X, Check, Eye, Trash2 } from 'lucide-react';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList
} from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

// Schema for multi-user notification form
const multiUserNotificationSchema = z.object({
  userIds: z.array(z.number()).default([]),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['RECHARGE', 'WALLET_CREDIT', 'WALLET_DEBIT', 'REFERRAL', 'ANNOUNCEMENT'], {
    required_error: 'Notification type is required',
  }),
  sendToAll: z.boolean().default(false),
  metadata: z.string().optional(),
});

export default function Notifications() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [sendToAll, setSendToAll] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery<{ notifications: Notification[] }>({
    queryKey: ['/api/notifications'],
  });
  
  // Fetch users for displaying usernames and for user selection
  const { data: usersData } = useQuery<{ users: User[] }>({
    queryKey: ['/api/users'],
  });

  // Filtered users for user selection dropdown
  const filteredUsers = usersData?.users.filter(user => {
    if (!userSearchTerm) return true;
    return (
      user.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
      user.id.toString().includes(userSearchTerm)
    );
  }) || [];

  // Handle selecting/deselecting users for bulk notifications
  const toggleUserSelection = (user: User) => {
    const isSelected = selectedUsers.some(u => u.id === user.id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Notification mutation
  // For storing notification batch results 
  const [notificationResults, setNotificationResults] = useState<{
    batchId?: string;
    successCount: number;
    failedCount: number;
    failedUserIds?: number[];
    timestamp: Date;
    type: string;
    message: string;
  } | null>(null);
  
  // For showing notification results modal
  const [showResultsModal, setShowResultsModal] = useState(false);

  const createMultiUserNotificationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof multiUserNotificationSchema>) => {
      try {
        // If sendToAll is true, pass empty userIds array to send to all users
        const payload = {
          ...data,
          userIds: data.sendToAll ? [] : data.userIds,
        };
        // apiRequest already returns the parsed JSON data
        return await apiRequest('POST', '/api/notifications', payload);
      } catch (error) {
        console.error("Notification API error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Complete the progress bar to 100%
      setSendProgress(100);
      
      // Store notification results for display
      setNotificationResults({
        batchId: data.batchId,
        successCount: data.count || 0,
        failedCount: data.failed || 0,
        failedUserIds: data.failedUserIds,
        timestamp: new Date(),
        type: multiUserForm.getValues('type'),
        message: multiUserForm.getValues('message')
      });
      
      // Wait for progress bar animation to complete before closing
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        setIsCreateModalOpen(false);
        
        // Show detailed results modal if there are any failures
        if (data.failed && data.failed > 0) {
          toast.success(`Notification sent to ${data.count} users with ${data.failed} failures. See details.`);
          setShowResultsModal(true);
        } else {
          toast.success(`Notification sent successfully to ${data.count} users`);
        }
        
        // Reset state for next time
        setSelectedUsers([]);
        setSendToAll(false);
        setSendProgress(0);
      }, 800);
    },
    onError: (error) => {
      // Reset progress on error
      setSendProgress(0);
      console.error("Failed to send notification:", error);
      toast.error(`Failed to send notification: ${error.message || "Network error"}`);
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async ({ id, read }: { id: number; read: boolean }) => {
      // apiRequest already returns the parsed JSON data
      return await apiRequest('PATCH', `/api/notifications/${id}`, { read });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast.success('Notification status updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update notification: ${error.message}`);
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      // apiRequest already returns the parsed JSON data
      return await apiRequest('DELETE', `/api/notifications/${id}`, null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast.success('Notification deleted successfully');
      if (isDetailsModalOpen) setIsDetailsModalOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to delete notification: ${error.message}`);
    },
  });
  
  // Form for creating multi-user notifications
  const multiUserForm = useForm<z.infer<typeof multiUserNotificationSchema>>({
    resolver: zodResolver(multiUserNotificationSchema),
    defaultValues: {
      userIds: [],
      message: '',
      type: undefined,
      sendToAll: false,
      metadata: undefined,
    },
  });

  // Reset form when modal is opened/closed
  useEffect(() => {
    if (isCreateModalOpen) {
      multiUserForm.reset();
      setSelectedUsers([]);
      setSendToAll(false);
      setUserSearchTerm('');
    }
  }, [isCreateModalOpen]);
  
  // Update form values when selected users change
  useEffect(() => {
    if (selectedUsers.length > 0) {
      multiUserForm.setValue('userIds', selectedUsers.map(user => user.id));
    } else {
      multiUserForm.setValue('userIds', []);
    }
  }, [selectedUsers]);
  
  // Update form value when sendToAll changes
  useEffect(() => {
    multiUserForm.setValue('sendToAll', sendToAll);
    if (sendToAll) {
      setSelectedUsers([]);
    }
  }, [sendToAll]);

  // Handle creating multi-user notifications
  const onCreateMultiUserNotification = (data: z.infer<typeof multiUserNotificationSchema>) => {
    setSendProgress(0);
    
    // Start progress animation if sending to all users
    if (data.sendToAll) {
      const totalUsers = usersData?.users.length || 0;
      if (totalUsers > 0) {
        // Simulate progress updates while sending
        const interval = setInterval(() => {
          setSendProgress(prev => {
            // Cap at 90% until we get confirmation
            const newValue = prev + (90 - prev) * 0.1;
            return newValue > 90 ? 90 : newValue;
          });
        }, 100);
        
        // Save interval ID to clear it later
        setTimeout(() => clearInterval(interval), 5000);
      }
    }
    
    createMultiUserNotificationMutation.mutate(data);
  };

  // Handle marking notification as read/unread
  const handleToggleRead = (id: number, read: boolean) => {
    markAsReadMutation.mutate({ id, read });
  };

  // Handle viewing notification details
  const handleViewDetails = (notification: Notification) => {
    setSelectedNotification(notification);
    setIsDetailsModalOpen(true);
  };

  // Handle deleting a notification
  const handleDeleteNotification = (id: number) => {
    if (confirm('Are you sure you want to delete this notification?')) {
      deleteNotificationMutation.mutate(id);
    }
  };

  // Get current user ID from session
  const userSession = useQuery<{ isAuthenticated: boolean; user?: { id: number, username: string } }>({
    queryKey: ['/api/auth/session'],
  });
  
  const currentUserId = userSession.data?.user?.id;
  
  // Helper function to extract batch information from notification metadata
  const getBatchInfo = (notification: Notification) => {
    if (!notification.metadata) return null;
    
    try {
      const metadata = JSON.parse(notification.metadata);
      return metadata.batchId ? metadata : null;
    } catch (e) {
      console.error("Error parsing notification metadata:", e);
      return null;
    }
  };
  
  // Calculate the total count of notifications sent in a batch
  const getTotalSentInBatch = (batchId: string) => {
    if (!notificationsData?.notifications) return 0;
    
    return notificationsData.notifications.filter(n => {
      const info = getBatchInfo(n);
      return info && info.batchId === batchId;
    }).length;
  };

  // Filter notifications - only show those sent by admin (not received notifications)
  let filteredNotifications = notificationsData?.notifications || [];
  
  // Only show notifications where the current user is NOT the recipient
  // (shows only sent notifications, not received notifications)
  if (currentUserId) {
    filteredNotifications = filteredNotifications.filter(notification => 
      notification.userId !== currentUserId
    );
  }
  
  // Apply search filter
  if (searchTerm) {
    filteredNotifications = filteredNotifications.filter(notification => 
      notification.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.userId.toString().includes(searchTerm)
    );
  }
  
  // Apply type filter
  if (typeFilter) {
    filteredNotifications = filteredNotifications.filter(notification => 
      notification.type.toUpperCase() === typeFilter.toUpperCase()
    );
  }

  const columns = [
    {
      key: "admin",
      title: "Sender",
      render: (notification: Notification) => {
        // Always display "System" as the sender
        const adminUsername = "System";
        
        return (
          <div className="flex items-center">
            <Avatar className="h-8 w-8 bg-primary/10">
              <AvatarFallback className="text-primary font-medium">
                {getInitials(adminUsername)}
              </AvatarFallback>
            </Avatar>
            <div className="ml-3">
              <p className="text-sm font-medium">{adminUsername}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "message",
      title: "Message",
      render: (notification: Notification) => (
        <p className="text-sm truncate max-w-xs">{notification.message}</p>
      ),
    },
    {
      key: "type",
      title: "Type",
      render: (notification: Notification) => {
        let badgeVariant: "default" | "destructive" | "recharge" | "success" | "referral" | "secondary" | "outline" = "default";
        switch (notification.type.toUpperCase()) {
          case "RECHARGE": badgeVariant = "recharge"; break;
          case "WALLET_CREDIT": badgeVariant = "success"; break;
          case "WALLET_DEBIT": badgeVariant = "destructive"; break;
          case "REFERRAL": badgeVariant = "referral"; break;
          case "ANNOUNCEMENT": badgeVariant = "secondary"; break;
          default: badgeVariant = "default";
        }
        return <Badge variant={badgeVariant} className="uppercase font-medium">{notification.type}</Badge>;
      },
    },

    {
      key: "timestamp",
      title: "Date",
      render: (notification: Notification) => (
        <span className="text-sm text-gray-500">
          {notification.timestamp ? new Date(notification.timestamp).toLocaleString() : 'N/A'}
        </span>
      ),
    },
    {
      key: "totalSent",
      title: "Total Sent",
      render: (notification: Notification) => {
        const batchInfo = getBatchInfo(notification);
        if (!batchInfo || !batchInfo.batchId) {
          return <span className="text-sm">1</span>;
        }
        
        const totalSent = getTotalSentInBatch(batchInfo.batchId);
        return (
          <Badge variant="outline" className="font-medium">
            {totalSent}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      title: "Actions",
      render: (notification: Notification) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(notification)} title="View Details">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteNotification(notification.id)} title="Delete Notification">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  // Filter UI component
  const FilterSection = () => (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div>
        <p className="text-sm mb-1 font-medium">Type</p>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="RECHARGE">Recharge</SelectItem>
            <SelectItem value="WALLET_CREDIT">Wallet Credit</SelectItem>
            <SelectItem value="WALLET_DEBIT">Wallet Debit</SelectItem>
            <SelectItem value="REFERRAL">Referral</SelectItem>
            <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto mt-auto">
        <Button 
          variant="outline" 
          onClick={() => {
            setTypeFilter('ALL');
          }}
        >
          Reset Filter
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-inter font-bold">Notifications</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Send Notification
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <FilterSection />
        
        <DataTable
          data={filteredNotifications}
          columns={columns}
          onSearch={setSearchTerm}
          isLoading={isLoading}
        />
      </div>

      {/* Notification Results Modal */}
      <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Notification Results</DialogTitle>
            <DialogDescription>
              Summary of the notification delivery results.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {notificationResults && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-green-600">Sent Successfully</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{notificationResults.successCount}</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-red-600">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{notificationResults.failedCount}</p>
                    </CardContent>
                  </Card>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Notification Details</h3>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p><span className="font-medium">Type:</span> {notificationResults.type}</p>
                    <p><span className="font-medium">Time:</span> {notificationResults.timestamp.toLocaleString()}</p>
                    <p><span className="font-medium">Message:</span> {notificationResults.message}</p>
                    {notificationResults.batchId && (
                      <p><span className="font-medium">Batch ID:</span> {notificationResults.batchId}</p>
                    )}
                  </div>
                </div>
                
                {notificationResults.failedCount > 0 && notificationResults.failedUserIds && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Failed Recipients</h3>
                    <div className="max-h-[150px] overflow-y-auto bg-gray-50 p-3 rounded-md">
                      <ul className="space-y-1">
                        {notificationResults.failedUserIds.map(userId => {
                          const user = usersData?.users.find(u => u.id === userId);
                          return (
                            <li key={userId} className="text-sm">
                              User ID: {userId} {user ? `(${user.username})` : ''}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowResultsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Notification Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none">
          <div className="bg-primary/5 py-4 px-6 border-b">
            <DialogTitle className="text-lg font-semibold">Send New Notification</DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Create and send notifications to users
            </DialogDescription>
          </div>
          
          <div className="px-6 py-4">
            <Form {...multiUserForm}>
              <form onSubmit={multiUserForm.handleSubmit(onCreateMultiUserNotification)} className="space-y-4">
                <Card className="border border-gray-100 shadow-sm">
                  <CardContent className="p-4 pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <FormField
                        control={multiUserForm.control}
                        name="sendToAll"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0">
                            <FormControl>
                              <Checkbox 
                                checked={sendToAll}
                                onCheckedChange={(checked) => {
                                  setSendToAll(!!checked);
                                }}
                                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-medium cursor-pointer">
                              Send to all users
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>

                    {!sendToAll && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel className="text-sm font-medium">Recipients</FormLabel>
                          {selectedUsers.length > 0 && (
                            <Badge variant="outline" className="font-medium">
                              {selectedUsers.length} selected
                            </Badge>
                          )}
                        </div>
                        
                        <Command className="border rounded-md bg-white">
                          <CommandInput 
                            placeholder="Search users..." 
                            value={userSearchTerm}
                            onValueChange={setUserSearchTerm}
                            className="border-none"
                          />
                          
                          {selectedUsers.length > 0 && (
                            <div className="border-t border-dashed px-2 py-1.5 flex flex-wrap gap-1.5">
                              {selectedUsers.map(user => (
                                <Badge 
                                  key={user.id} 
                                  variant="secondary"
                                  className="flex items-center gap-1 py-1"
                                >
                                  <span>{user.username}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-4 w-4 p-0 rounded-full hover:bg-gray-200"
                                    onClick={() => toggleUserSelection(user)}
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {!filteredUsers.length && (
                            <p className="py-3 px-2 text-sm text-center text-gray-500">No users found</p>
                          )}
                          
                          <CommandList className="max-h-[150px] overflow-auto">
                            <CommandGroup>
                              {filteredUsers.map((user) => {
                                const isSelected = selectedUsers.some(u => u.id === user.id);
                                return (
                                  <CommandItem
                                    key={user.id}
                                    value={user.username}
                                    onSelect={() => toggleUserSelection(user)}
                                    className="flex items-center cursor-pointer py-1.5"
                                  >
                                    <div className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border ${isSelected ? 'bg-primary border-primary' : 'border-gray-300'}`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="flex items-center">
                                      <Avatar className="h-5 w-5 mr-2">
                                        <AvatarFallback className="text-[10px]">{getInitials(user.name || user.username)}</AvatarFallback>
                                      </Avatar>
                                      <span className="text-sm">{user.username}</span>
                                      {user.name && <span className="text-gray-500 ml-2 text-xs">({user.name})</span>}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={multiUserForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Notification Type*</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="RECHARGE">Recharge</SelectItem>
                            <SelectItem value="WALLET_CREDIT">Wallet Credit</SelectItem>
                            <SelectItem value="WALLET_DEBIT">Wallet Debit</SelectItem>
                            <SelectItem value="REFERRAL">Referral</SelectItem>
                            <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                
                  <FormField
                    control={multiUserForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">Message*</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter notification message" 
                            className="resize-none h-20 bg-white" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Progress bar shown when sending to all users */}
                {(sendProgress > 0 || createMultiUserNotificationMutation.isPending) && sendToAll && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Sending notifications to all users...</span>
                      <span>{Math.round(sendProgress)}%</span>
                    </div>
                    <Progress value={sendProgress} className="w-full" />
                  </div>
                )}
                
                <div className="flex justify-end pt-2 space-x-2 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                    size="sm"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={
                      createMultiUserNotificationMutation.isPending || 
                      (!sendToAll && selectedUsers.length === 0)
                    }
                    size="sm"
                    className="gap-1"
                  >
                    {createMultiUserNotificationMutation.isPending ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M22 2L15.8 8.2"></path>
                          <path d="M2 15l15.3-15 4.8 4.8-15.3 15L2 22V15Z"></path>
                        </svg>
                        {`Send to ${sendToAll 
                          ? 'All Users' 
                          : selectedUsers.length > 0 
                            ? `${selectedUsers.length} User${selectedUsers.length > 1 ? 's' : ''}` 
                            : 'Users'}`
                        }
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notification Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none">
          <div className="bg-primary/5 py-4 px-6 border-b flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold">Notification Details</DialogTitle>
              <DialogDescription className="text-sm mt-1">
                System notification information
              </DialogDescription>
            </div>
            {selectedNotification && (
              <Badge variant={
                selectedNotification.type === "RECHARGE" ? "recharge" as const :
                selectedNotification.type === "WALLET_CREDIT" ? "success" as const :
                selectedNotification.type === "WALLET_DEBIT" ? "destructive" as const :
                selectedNotification.type === "ANNOUNCEMENT" ? "secondary" as const :
                "referral" as const
              } className="uppercase font-medium">
                {selectedNotification?.type}
              </Badge>
            )}
          </div>
          
          {selectedNotification && (
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Sender Card */}
              <div className="flex items-center mb-5 pb-4 border-b border-dashed">
                <Avatar className="h-10 w-10 bg-primary/10 mr-3">
                  <AvatarFallback className="text-primary font-medium">
                    {getInitials("System")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">System</p>
                  <p className="text-xs text-gray-500">
                    {selectedNotification.timestamp ? new Date(selectedNotification.timestamp).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              
              {/* Message Card */}
              <div className="mb-5">
                <div className="flex items-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-gray-500">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  <h3 className="text-sm font-medium">Message</h3>
                </div>
                <div className="ml-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm">{selectedNotification.message}</p>
                </div>
              </div>
              
              {/* Batch Information */}
              {(() => {
                // Try to parse the metadata to show batch info in a nice format
                const batchInfo = getBatchInfo(selectedNotification);
                if (batchInfo && batchInfo.batchId) {
                  const totalSentCount = getTotalSentInBatch(batchInfo.batchId);
                  return (
                    <div className="mb-5">
                      <div className="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-gray-500">
                          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                          <path d="M7 15h0"></path>
                          <path d="M2 9h20"></path>
                        </svg>
                        <h3 className="text-sm font-medium">Batch Information</h3>
                      </div>
                      <div className="ml-6 p-4 bg-gray-50 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Batch ID</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {batchInfo.batchId}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Recipients</span>
                          <Badge variant="secondary" className="font-medium">
                            {totalSentCount}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                } else if (selectedNotification.metadata) {
                  // Fallback to showing raw metadata
                  return (
                    <div className="mb-5">
                      <div className="flex items-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-gray-500">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <path d="M14 2v6h6"></path>
                          <path d="M16 13H8"></path>
                          <path d="M16 17H8"></path>
                          <path d="M10 9H8"></path>
                        </svg>
                        <h3 className="text-sm font-medium">Metadata</h3>
                      </div>
                      <div className="ml-6">
                        <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                          {selectedNotification.metadata}
                        </pre>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
              <div className="flex justify-end space-x-2 pt-4 border-t mt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailsModalOpen(false)}
                  size="sm"
                  className="gap-1"
                >
                  <X className="h-4 w-4" /> Close
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteNotification(selectedNotification.id)}
                  disabled={deleteNotificationMutation.isPending}
                  size="sm"
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteNotificationMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
