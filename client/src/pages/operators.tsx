import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Operator, insertOperatorSchema } from '@shared/schema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { AlertCircleIcon, RefreshCw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Extend schema for operator form
const operatorFormSchema = insertOperatorSchema.extend({
  name: z.string().min(1, 'Operator name is required'),
  code: z.string().min(1, 'Operator code is required'),
  type: z.enum(['MOBILE', 'DTH'], {
    required_error: 'Operator type is required',
  }),
  commission: z.string().min(1, 'Commission is required').refine(val => !isNaN(parseFloat(val)), 'Must be a number'),
  isEnabled: z.boolean().default(true),
});

export default function Operators() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Fetch operators with improved performance settings
  const { data: operatorsData, isLoading } = useQuery<{ operators: Operator[] }>({
    queryKey: ['/api/operators'],
    refetchOnWindowFocus: true,
    staleTime: 5000, // Data becomes stale after 5 seconds
    refetchInterval: 15000, // Refresh data every 15 seconds in the background
  });

  // Create operator mutation
  const createOperatorMutation = useMutation({
    mutationFn: async (operatorData: z.infer<typeof operatorFormSchema>) => {
      const response = await apiRequest('POST', '/api/operators', operatorData);
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data) => {
      // Force an immediate refetch rather than just invalidating
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      
      // Reset form and close modal
      createForm.reset({
        name: '',
        code: '',
        type: undefined,
        commission: '',
        isEnabled: true,
      });
      setIsCreateModalOpen(false);
      
      // Show detailed success toast
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Operator created successfully!</span>
          <span className="text-xs">
            {data?.operator?.name ? `${data.operator.name} has been added.` : 'The new operator has been added.'}
          </span>
        </div>,
        { duration: 5000 }
      );
      
      // Force a refresh of operators list
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/operators'] });
      }, 300);
    },
    onError: (error: any) => {
      // Check if there's a specific message from the server
      const errorResponse = error.data || {};
      
      if (errorResponse.message && errorResponse.message.includes('already exists')) {
        // Handle duplicate operator code error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Operator code already exists</span>
            <span className="text-xs">Please use a different operator code.</span>
          </div>
        );
      } else {
        // Generic error message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Failed to create operator</span>
            <span className="text-xs">
              {error.message || "We couldn't create this operator. Please try again."}
            </span>
          </div>
        );
      }
      
      // Log the full error for debugging
      console.error('Operator creation error:', error);
    },
  });

  // Update operator mutation
  const updateOperatorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Operator> }) => {
      const response = await apiRequest('PATCH', `/api/operators/${id}`, data);
      // Handle both JSON and non-JSON responses properly
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data, variables) => {
      // Force an immediate refetch rather than just invalidating
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      
      // Close edit modal
      setIsEditModalOpen(false);
      
      // Show detailed success toast
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Operator updated successfully!</span>
          <span className="text-xs">
            The operator information has been updated.
          </span>
        </div>,
        { duration: 5000 }
      );
      
      // Force a refresh of operators list
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/operators'] });
      }, 300);
    },
    onError: (error: any) => {
      // Check if there's a specific message from the server
      const errorResponse = error.data || {};
      
      if (errorResponse.message && errorResponse.message.includes('already exists')) {
        // Handle duplicate operator code error
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Operator code already exists</span>
            <span className="text-xs">Please use a different operator code.</span>
          </div>
        );
      } else {
        // Generic error message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Failed to update operator</span>
            <span className="text-xs">
              {error.message || "We couldn't update this operator. Please try again."}
            </span>
          </div>
        );
      }
      
      // Log the full error for debugging
      console.error('Operator update error:', error);
    },
  });

  // Toggle operator status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: number; isEnabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/operators/${id}`, { isEnabled });
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data, variables) => {
      // Show subtle toast notification with status information
      const statusText = variables.isEnabled ? 'enabled' : 'disabled';
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Operator {statusText}</span>
        </div>,
        { duration: 1500 }
      );
      
      // We don't need to invalidate or refetch here since we already updated the cache optimistically
      // This prevents the UI from flickering or showing delays
    },
    onError: (error: any) => {
      // Rollback optimistic update on error
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      
      // Show error toast
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Failed to update status</span>
          <span className="text-xs">
            {error.message || "We couldn't update the operator status. Please try again."}
          </span>
        </div>
      );
      
      // Log the full error for debugging
      console.error('Operator status update error:', error);
    },
  });

  // Delete operator mutation
  const deleteOperatorMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/operators/${id}`, null);
      try {
        return await response.json();
      } catch (error) {
        return { success: response.ok }; // Return simple success object if not JSON
      }
    },
    onSuccess: (data, id) => {
      // Show minimal success toast to avoid overwhelming the user
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium">Operator deleted</span>
        </div>,
        { duration: 2000 }
      );
      
      // We don't need to refetch here since we've already optimistically updated the UI
      // This prevents delays and unnecessary network requests
    },
    onError: (error: any, id) => {
      // Rollback the optimistic update by refetching data
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      
      // Check if there's a specific message from the server
      const errorResponse = error.data || {};
      
      if (errorResponse.message && errorResponse.message.includes('foreign key constraint')) {
        // Handle constraint error with user-friendly message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Cannot delete operator</span>
            <span className="text-xs">
              This operator has related transactions or other data that prevent deletion. 
              Consider disabling it instead.
            </span>
          </div>
        );
      } else {
        // Generic error message
        toast.error(
          <div className="flex flex-col gap-1">
            <span className="font-medium">Failed to delete operator</span>
            <span className="text-xs">
              {error.message || "We couldn't delete this operator. Please try again."}
            </span>
          </div>
        );
      }
      
      // Force a refresh to ensure UI is in sync with backend data
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/operators'] });
      }, 300);
      
      // Log the full error for debugging
      console.error('Operator deletion error:', error);
    },
  });

  // Form for creating a new operator
  const createForm = useForm<z.infer<typeof operatorFormSchema>>({
    resolver: zodResolver(operatorFormSchema),
    defaultValues: {
      name: '',
      code: '',
      type: undefined,
      commission: '',
      isEnabled: true,
    },
  });

  // Form for editing an operator
  const editForm = useForm<z.infer<typeof operatorFormSchema>>({
    resolver: zodResolver(operatorFormSchema),
    defaultValues: {
      name: '',
      code: '',
      type: undefined,
      commission: '',
      isEnabled: true,
    },
  });

  // Handle creating a new operator
  const onCreateOperator = (data: z.infer<typeof operatorFormSchema>) => {
    createOperatorMutation.mutate(data);
  };

  // Handle updating an operator
  const onUpdateOperator = (data: z.infer<typeof operatorFormSchema>) => {
    if (selectedOperator) {
      updateOperatorMutation.mutate({
        id: selectedOperator.id,
        data,
      });
    }
  };

  // Handle toggling operator status
  const handleToggleStatus = (id: number, isEnabled: boolean) => {
    toggleStatusMutation.mutate({ id, isEnabled });
  };

  // Open the edit modal and populate form data
  const handleEditOperator = (operator: Operator) => {
    setSelectedOperator(operator);
    editForm.reset({
      name: operator.name,
      code: operator.code,
      type: operator.type as 'MOBILE' | 'DTH',
      commission: operator.commission.toString(),
      isEnabled: operator.isEnabled === null ? undefined : operator.isEnabled,
    });
    setIsEditModalOpen(true);
  };

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [operatorToDelete, setOperatorToDelete] = useState<Operator | null>(null);

  // Handle initiating operator deletion
  const handleDeleteOperator = (operator: Operator) => {
    setOperatorToDelete(operator);
    setIsDeleteDialogOpen(true);
  };
  
  // Handle confirming operator deletion with optimistic updates
  const confirmDeleteOperator = () => {
    if (operatorToDelete) {
      // Implement optimistic update
      const currentOperators = operatorsData?.operators || [];
      const updatedOperators = currentOperators.filter(op => op.id !== operatorToDelete.id);
      
      // Update the cache immediately for responsive UI
      queryClient.setQueryData(['/api/operators'], { 
        operators: updatedOperators
      });
      
      // Close dialog immediately for better UX
      setIsDeleteDialogOpen(false);
      
      // Then perform the actual API call
      deleteOperatorMutation.mutate(operatorToDelete.id);
      setOperatorToDelete(null);
    }
  };

  // Filter operators
  let filteredOperators = operatorsData?.operators || [];
  
  // Apply search filter
  if (searchTerm) {
    filteredOperators = filteredOperators.filter(operator => 
      operator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      operator.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Apply type filter
  if (typeFilter && typeFilter !== 'ALL') {
    filteredOperators = filteredOperators.filter(operator => 
      operator.type.toUpperCase() === typeFilter.toUpperCase()
    );
  }

  const columns = [
    {
      key: "id",
      title: "ID",
      sortable: true,
      render: (operator: Operator) => <span>#{operator.id}</span>,
    },
    {
      key: "name",
      title: "Name",
      sortable: true,
      render: (operator: Operator) => <span className="font-medium">{operator.name}</span>,
    },
    {
      key: "code",
      title: "Code",
      sortable: true,
      render: (operator: Operator) => <span>{operator.code}</span>,
    },
    {
      key: "type",
      title: "Type",
      sortable: true,
      render: (operator: Operator) => (
        <Badge variant={operator.type === 'MOBILE' ? 'recharge' : 'addFund'}>
          {operator.type}
        </Badge>
      ),
    },
    {
      key: "commission",
      title: "Commission",
      sortable: true,
      render: (operator: Operator) => <span>{parseFloat(operator.commission.toString())}%</span>,
    },
    {
      key: "isEnabled",
      title: "Status",
      sortable: true,
      render: (operator: Operator) => (
        <div className="flex items-center space-x-2">
          <Switch
            checked={operator.isEnabled === null ? false : operator.isEnabled}
            onCheckedChange={(checked) => {
              // Optimistic update for instant UI feedback
              const updatedOperators = operatorsData?.operators.map(op => 
                op.id === operator.id ? {...op, isEnabled: checked} : op
              );
              
              // Update the cache immediately
              queryClient.setQueryData(['/api/operators'], { 
                operators: updatedOperators
              });
              
              // Then perform the actual API call
              handleToggleStatus(operator.id, checked);
            }}
            className="data-[state=checked]:bg-green-500"
          />
          <span className={`text-xs ${operator.isEnabled ? 'text-green-600' : 'text-gray-500'}`}>
            {operator.isEnabled ? 'Active' : 'Inactive'}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (operator: Operator) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm" onClick={() => handleEditOperator(operator)}>
            Edit
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-500" 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteOperator(operator);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // Filter UI component
  const FilterSection = () => (
    <div className="mb-6 flex items-center gap-4">
      <div>
        <p className="text-sm mb-1 font-medium">Type</p>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="MOBILE">Mobile</SelectItem>
            <SelectItem value="DTH">DTH</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="ml-auto mt-auto">
        <Button variant="outline" onClick={() => {
          setSearchTerm('');
          setTypeFilter('ALL');
        }}>
          Reset Filters
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-inter font-bold">Operators</h1>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          Add Operator
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <FilterSection />
        
        <DataTable
          data={filteredOperators}
          columns={columns}
          onSearch={setSearchTerm}
          isLoading={isLoading}
        />
      </div>

      {/* Create Operator Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Operator</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new operator.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateOperator)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Airtel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator Code*</FormLabel>
                    <FormControl>
                      <Input placeholder="AIRTEL" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique code used to identify the operator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator Type*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MOBILE">Mobile</SelectItem>
                          <SelectItem value="DTH">DTH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission (%)*</FormLabel>
                      <FormControl>
                        <Input placeholder="2.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Enabled</FormLabel>
                      <FormDescription>
                        Enable this operator for transactions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={createOperatorMutation.isPending}>
                  {createOperatorMutation.isPending ? 'Creating...' : 'Create Operator'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Operator Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Operator</DialogTitle>
            <DialogDescription>
              Update the operator details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onUpdateOperator)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator Name*</FormLabel>
                    <FormControl>
                      <Input placeholder="Airtel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operator Code*</FormLabel>
                    <FormControl>
                      <Input placeholder="AIRTEL" {...field} />
                    </FormControl>
                    <FormDescription>
                      A unique code used to identify the operator
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Operator Type*</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MOBILE">Mobile</SelectItem>
                          <SelectItem value="DTH">DTH</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="commission"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission (%)*</FormLabel>
                      <FormControl>
                        <Input placeholder="2.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="isEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Enabled</FormLabel>
                      <FormDescription>
                        Enable this operator for transactions
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateOperatorMutation.isPending}>
                  {updateOperatorMutation.isPending ? 'Updating...' : 'Update Operator'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="py-4">
              <div className="space-y-4">
                <div className="flex items-center p-4 border border-red-100 bg-red-50 rounded-lg">
                  <div className="mr-4 bg-red-100 rounded-full p-2">
                    <AlertCircleIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Are you sure you want to delete this operator?</p>
                    {operatorToDelete && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">{operatorToDelete.name}</span> ({operatorToDelete.code})
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  This action cannot be undone. This will permanently delete the operator
                  and remove all associated data.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-between border-t pt-4 mt-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={confirmDeleteOperator}
              disabled={deleteOperatorMutation.isPending}
            >
              {deleteOperatorMutation.isPending ? (
                <div className="flex items-center">
                  <span className="animate-spin mr-2">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                  Deleting...
                </div>
              ) : (
                "Delete Operator"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
