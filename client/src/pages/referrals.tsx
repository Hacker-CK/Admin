import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Eye, TrendingUp, UserPlus, ArrowUpRight, MoreVertical, ExternalLink, Download, X, Info, Users, DollarSign, FileText } from 'lucide-react';
import jsPDF from 'jspdf';

import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { formatCurrency, formatCurrencyFull, formatDate } from '@/lib/utils';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

// Extended user type with referral details
interface ReferralUser extends User {
  referredUsers: User[];
  totalEarnings: number;
}

export default function Referrals() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [viewStatsOpen, setViewStatsOpen] = useState(false);
  const [showReferralsOpen, setShowReferralsOpen] = useState(false);
  const [exportDataOpen, setExportDataOpen] = useState(false);
  
  // Function to handle dialog actions
  const handleDialogAction = (user: ReferralUser, action: 'details' | 'stats' | 'referrals' | 'export') => {
    setSelectedUser(user);
    
    // Reset all dialog states first
    setViewDetailsOpen(false);
    setViewStatsOpen(false);
    setShowReferralsOpen(false);
    setExportDataOpen(false);
    
    // Then set the appropriate one to true
    switch (action) {
      case 'details':
        setViewDetailsOpen(true);
        break;
      case 'stats':
        setViewStatsOpen(true);
        break;
      case 'referrals':
        setShowReferralsOpen(true);
        break;
      case 'export':
        setExportDataOpen(true);
        break;
    }
  };
  
  // Function to handle export action
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (!selectedUser) return;
    
    if (format === 'pdf') {
      // For PDF we'll use jsPDF to generate it
      generatePDF(selectedUser);
    } else {
      // For CSV and Excel, generate the data as a string
      const exportData = generateExportData(selectedUser, format);
      
      // Create a download link
      const contentType = format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel';
      const blob = new Blob([exportData], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Billaye_Referral_Report_${selectedUser.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    }
    
    // Close the dialog
    setExportDataOpen(false);
  };
  
  // Function to generate PDF with proper formatting
  const generatePDF = (user: ReferralUser) => {
    const doc = new jsPDF();
    const primaryColor = "#4f46e5"; // Indigo color for branding
    const date = new Date();
    
    // Company header
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, 210, 25, "F");
    
    // Add company info
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text('BILLAYE', 14, 15);
    
    // Add tagline
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text('Financial Services Platform', 70, 15);
    
    // Add contact info on the right
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text('info@billaye.in', 170, 10, { align: 'right' });
    doc.text('9679292474', 170, 15, { align: 'right' });
    doc.text(`Generated: ${date.toLocaleString()}`, 170, 20, { align: 'right' });
    
    // Report title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text('REFERRAL DATA REPORT', 105, 35, { align: 'center' });
    
    // Add watermark logo in the background
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(60);
    doc.text('BILLAYE', 105, 150, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Add decorative element
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 195, 40);
    
    // Summary box
    doc.setFillColor(245, 245, 255);
    doc.roundedRect(14, 45, 180, 40, 3, 3, 'F');
    
    // User info section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor);
    doc.text('User Information', 20, 55);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Create two-column layout for user info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Left column
    doc.text(`User ID: ${user.id}`, 20, 65);
    doc.text(`Username: ${user.username}`, 20, 70);
    doc.text(`Name: ${user.name || 'N/A'}`, 20, 75);
    
    // Right column
    doc.text(`Email: ${user.email || 'N/A'}`, 105, 65);
    doc.text(`Referral Code: ${user.referralCode || 'N/A'}`, 105, 70);
    
    // Referral stats with highlighted box
    doc.setFillColor(primaryColor);
    doc.roundedRect(14, 90, 180, 25, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('Referral Statistics', 20, 100);
    
    // Stats in white text
    doc.setFontSize(10);
    doc.text(`Total Referrals: ${user.referralCount || 0}`, 20, 110);
    
    // Format and align the earnings to look like financial data
    doc.text(`Total Earnings: ${formatCurrency(user.referralEarnings || '0')}`, 105, 110);
    
    const status = user.referralPending 
      ? 'Pending' 
      : (user.referralCount || 0) > 0 
        ? 'Completed' 
        : 'None';
    doc.text(`Status: ${status}`, 170, 110);
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    
    // Add referred users section if available
    if (user.referredUsers && user.referredUsers.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(primaryColor);
      doc.text('Referred Users', 14, 130);
      
      // Table header background
      doc.setFillColor(primaryColor);
      doc.rect(14, 135, 181, 10, 'F');
      
      // Create table headers
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('ID', 18, 142);
      doc.text('Username', 35, 142);
      doc.text('Name', 75, 142);
      doc.text('Email', 115, 142);
      doc.text('Status', 175, 142);
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      // Add table rows with alternating background
      let yPos = 150;
      user.referredUsers.forEach((referredUser, index) => {
        // Check if we need a new page
        if (yPos > 270) {
          doc.addPage();
          
          // Add company header on new page
          doc.setFillColor(primaryColor);
          doc.rect(0, 0, 210, 15, "F");
          
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text('BILLAYE', 14, 10);
          
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(`Page ${doc.getNumberOfPages()}`, 195, 10, { align: 'right' });
          
          // Reset text color
          doc.setTextColor(0, 0, 0);
          
          // Table header on new page
          yPos = 30;
          
          // Table header background
          doc.setFillColor(primaryColor);
          doc.rect(14, yPos - 7, 181, 10, 'F');
          
          // Create table headers
          doc.setFontSize(10);
          doc.setTextColor(255, 255, 255);
          doc.text('ID', 18, yPos);
          doc.text('Username', 35, yPos);
          doc.text('Name', 75, yPos);
          doc.text('Email', 115, yPos);
          doc.text('Status', 175, yPos);
          
          // Reset text color
          doc.setTextColor(0, 0, 0);
          
          yPos += 15;
        }
        
        // Add zebra striping for readability
        if (index % 2 === 0) {
          doc.setFillColor(245, 245, 255);
          doc.rect(14, yPos - 7, 181, 10, 'F');
        }
        
        const status = referredUser.referralPending ? 'Pending' : 'Active';
        
        doc.setFontSize(9);
        doc.text(referredUser.id.toString(), 18, yPos);
        doc.text(referredUser.username, 35, yPos);
        doc.text(referredUser.name || 'N/A', 75, yPos);
        doc.text(referredUser.email || 'N/A', 115, yPos);
        
        // Add status with color-coding
        if (status === 'Active') {
          doc.setTextColor(0, 128, 0); // Green for active
        } else {
          doc.setTextColor(255, 140, 0); // Orange for pending
        }
        doc.setFont("helvetica", "bold");
        doc.text(status, 175, yPos);
        
        // Reset text color and font
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        
        yPos += 10;
      });
    }
    
    // Add footer with company info on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, 280, 195, 280);
      
      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Billaye - Financial Services Platform | info@billaye.in | 9679292474`, 105, 285, { align: 'center' });
      doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: 'right' });
    }
    
    // Save the PDF with the company name prefix
    doc.save(`Billaye_Referral_Report_${user.id}.pdf`);
  };
  
  // Helper to generate export data for CSV and Excel
  const generateExportData = (user: ReferralUser, format: 'csv' | 'excel'): string => {
    // Generate CSV format data with company branding
    // In a real app, you might want to use a CSV library
    const date = new Date();
    
    // Add company header
    let csv = "BILLAYE - Financial Services Platform\n";
    csv += "Email: info@billaye.in, Contact: 9679292474\n";
    csv += `Referral Data Report - Generated on: ${date.toLocaleString()}\n\n`;
    
    // Add user information section
    csv += "USER INFORMATION\n";
    const headers = ["User ID", "Username", "Name", "Email", "Referral Code", "Referral Count", "Referral Earnings", "Status"];
    const userData = [
      user.id.toString(),
      user.username,
      user.name || '',
      user.email || '',
      user.referralCode || '',
      (user.referralCount || 0).toString(),
      (user.referralEarnings || '0').toString(),
      user.referralPending ? 'Pending' : ((user.referralCount || 0) > 0 ? 'Completed' : 'None')
    ];
    
    csv += headers.join(',') + '\n';
    csv += userData.join(',') + '\n\n';
    
    // Add referred users section if available
    if (user.referredUsers && user.referredUsers.length > 0) {
      csv += "REFERRED USERS\n";
      csv += "ID,Username,Name,Email,Status\n";
      
      user.referredUsers.forEach(referredUser => {
        const status = referredUser.referralPending ? 'Pending' : 'Active';
        const row = [
          referredUser.id.toString(),
          referredUser.username,
          referredUser.name || '',
          referredUser.email || '',
          status
        ].join(',');
        csv += row + '\n';
      });
    }
    
    // Add footer
    csv += "\nThis report is generated by Billaye Financial Services Platform.\n";
    csv += "For support, please contact info@billaye.in or call 9679292474.\n";
    
    return csv;
  };
  
  // Build query parameters for API requests
  const getQueryParams = () => {
    let params = new URLSearchParams();
    
    if (dateRange?.from) {
      params.append('startDate', dateRange.from.toISOString());
    }
    
    if (dateRange?.to) {
      params.append('endDate', dateRange.to.toISOString());
    }
    
    params.append('timeFrame', timeFrame);
    
    return params.toString();
  };
  
  // Fetch referrals data
  const { data: referralsData, isLoading } = useQuery<{ users: ReferralUser[] }>({
    queryKey: ['/api/referrals', getQueryParams()],
    queryFn: async () => {
      const response = await fetch(`/api/referrals?${getQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch referrals');
      return response.json();
    }
  });

  // Fetch referral statistics
  const { data: statsData, isLoading: isLoadingStats } = useQuery<{
    totalReferrals: number;
    totalEarnings: number;
    averageEarningsPerReferral: number;
    timeStats: { period: string; referrals: number; earnings: number }[];
    timeFrame: 'daily' | 'weekly' | 'monthly';
  }>({
    queryKey: ['/api/referrals/stats', getQueryParams()],
    queryFn: async () => {
      const response = await fetch(`/api/referrals/stats?${getQueryParams()}`);
      if (!response.ok) throw new Error('Failed to fetch referral stats');
      return response.json();
    }
  });

  // Filter referrals
  let filteredReferrals = referralsData?.users || [];
  
  // Apply search filter
  if (searchTerm) {
    filteredReferrals = filteredReferrals.filter(user => 
      (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.referralCode && user.referralCode.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
  
  // Apply status filter
  if (statusFilter && statusFilter !== 'ALL') {
    filteredReferrals = filteredReferrals.filter(user => {
      if (statusFilter === 'pending') return user.referralPending;
      if (statusFilter === 'completed') return !user.referralPending && (user.referralCount || 0) > 0;
      if (statusFilter === 'none') return (user.referralCount || 0) === 0;
      return true;
    });
  }

  const columns = [
    {
      key: "user",
      title: "User",
      render: (user: ReferralUser) => (
        <div className="flex items-center">
          <Avatar className="h-8 w-8">
            <AvatarFallback name={user.name || user.username} />
          </Avatar>
          <div className="ml-3">
            <p className="text-sm font-medium">{user.name || user.username}</p>
            <p className="text-xs text-gray-500">{user.email || `ID: ${user.id}`}</p>
          </div>
        </div>
      ),
    },
    {
      key: "referralCode",
      title: "Referral Code",
      render: (user: ReferralUser) => (
        <span className="text-sm font-medium">{user.referralCode || 'N/A'}</span>
      ),
    },
    {
      key: "referredBy",
      title: "Referred By",
      render: (user: ReferralUser) => (
        <span className="text-sm">{user.referredBy || 'N/A'}</span>
      ),
    },
    {
      key: "referralCount",
      title: "Referrals",
      render: (user: ReferralUser) => (
        <span className="text-sm font-medium">{user.referralCount || 0}</span>
      ),
    },
    {
      key: "earnings",
      title: "Earnings",
      render: (user: ReferralUser) => (
        <span className="text-sm font-medium"><CurrencyDisplay amount={user.referralEarnings || '0'} /></span>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (user: ReferralUser) => {
        if (user.referralPending) {
          return <Badge variant="pending">Pending</Badge>;
        } else if ((user.referralCount || 0) > 0) {
          return <Badge variant="success">Completed</Badge>;
        } else {
          return <Badge variant="outline">None</Badge>;
        }
      },
    },
    {
      key: "actions",
      title: "Actions",
      render: (user: ReferralUser) => (
        <div className="flex items-center gap-1">
          {/* View Details Button */}
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-primary" 
                  onClick={() => handleDialogAction(user, 'details')}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Details</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
          
          {/* View Stats Button */}
          <TooltipProvider>
            <TooltipUI>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-blue-600" 
                  onClick={() => handleDialogAction(user, 'stats')}
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View Stats</p>
              </TooltipContent>
            </TooltipUI>
          </TooltipProvider>
          
          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDialogAction(user, 'referrals')} className="flex items-center">
                <UserPlus className="mr-2 h-4 w-4" />
                <span>Show Referrals</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDialogAction(user, 'export')} className="flex items-center">
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>Export Data</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // Filter UI component
  const FilterSection = () => (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm mb-1 font-medium">Date Range</p>
        <DateRangePicker 
          dateRange={dateRange} 
          onDateRangeChange={setDateRange} 
        />
      </div>
      <div>
        <p className="text-sm mb-1 font-medium">Status</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="ml-auto mt-auto">
        <Button 
          variant="outline" 
          onClick={() => {
            setDateRange(undefined);
            setStatusFilter('ALL');
          }}
        >
          Reset Filters
        </Button>
      </div>
    </div>
  );

  // Stats cards
  const StatsCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Total Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingStats ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              statsData?.totalReferrals || 0
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Total Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingStats ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <CurrencyDisplay amount={statsData?.totalEarnings || 0} />
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Avg. Per Referral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingStats ? (
              <div className="h-8 w-20 bg-gray-200 rounded animate-pulse"></div>
            ) : (
              <CurrencyDisplay amount={statsData?.averageEarningsPerReferral || 0} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Chart component
  const ReferralChart = () => {
    // Get the appropriate time period description
    const getTimeDescription = () => {
      if (timeFrame === 'daily') return 'Daily';
      if (timeFrame === 'weekly') return 'Weekly';
      return 'Monthly';
    };
    
    return (
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Referral Performance</CardTitle>
            <CardDescription>{getTimeDescription()} referrals and earnings trend</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              size="sm"
              variant={timeFrame === 'daily' ? 'default' : 'outline'} 
              onClick={() => setTimeFrame('daily')}
            >
              Daily
            </Button>
            <Button 
              size="sm"
              variant={timeFrame === 'weekly' ? 'default' : 'outline'} 
              onClick={() => setTimeFrame('weekly')}
            >
              Weekly
            </Button>
            <Button 
              size="sm"
              variant={timeFrame === 'monthly' ? 'default' : 'outline'} 
              onClick={() => setTimeFrame('monthly')}
            >
              Monthly
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {isLoadingStats ? (
              <div className="w-full h-full bg-gray-100 rounded animate-pulse"></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statsData?.timeStats || []}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="period" 
                    angle={timeFrame === 'daily' ? -45 : 0}
                    textAnchor={timeFrame === 'daily' ? "end" : "middle"}
                    height={50}
                  />
                  <YAxis yAxisId="left" orientation="left" stroke="#1976D2" />
                  <YAxis yAxisId="right" orientation="right" stroke="#FF5722" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'earnings') return [formatCurrency(value as number), 'Earnings'];
                      return [value, 'Referrals'];
                    }}
                  />
                  <Bar yAxisId="left" dataKey="referrals" fill="#1976D2" name="Referrals" />
                  <Bar yAxisId="right" dataKey="earnings" fill="#FF5722" name="Earnings" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-inter font-bold">Referrals</h1>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Chart */}
      <ReferralChart />

      {/* Referrals Table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <FilterSection />
        
        <DataTable
          data={filteredReferrals}
          columns={columns}
          onSearch={setSearchTerm}
          isLoading={isLoading}
        />
      </div>
      
      {/* Controlled Dialogs */}
      {selectedUser && (
        <>
          {/* View Details Dialog */}
          <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
            <DialogContent className="sm:max-w-[650px]">
              <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                  <div className="bg-primary p-1.5 rounded-md mr-3">
                    <Info className="h-5 w-5 text-white" />
                  </div>
                  User Referral Details
                </DialogTitle>
                <DialogDescription className="text-base">
                  Detailed information about user referral account and performance metrics.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {/* User profile with gradient banner */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-blue-500/80 h-24 rounded-t-lg"></div>
                  <div className="relative pt-16 pb-4 px-4 bg-white rounded-lg shadow-sm border border-gray-100">
                    <Avatar className="h-16 w-16 absolute -top-8 left-4 ring-4 ring-white">
                      <AvatarFallback className="text-lg bg-primary text-white" name={selectedUser.name || selectedUser.username} />
                    </Avatar>
                    <div className="ml-2 mt-2">
                      <h3 className="text-xl font-bold">{selectedUser.name || selectedUser.username}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        {selectedUser.email || `ID: ${selectedUser.id}`}
                        <span className="inline-flex">
                          {selectedUser.referralPending ? (
                            <Badge variant="pending" className="ml-2">Pending</Badge>
                          ) : (selectedUser.referralCount || 0) > 0 ? (
                            <Badge variant="success" className="ml-2">Completed</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-2">None</Badge>
                          )}
                        </span>
                      </p>
                    </div>
                    
                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-4 mt-4 border-t border-gray-100 pt-4">
                      <div className="text-center p-2 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-500">Total Referrals</p>
                        <p className="text-2xl font-bold text-primary">{selectedUser.referralCount || 0}</p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-500">Total Earnings</p>
                        <p className="text-2xl font-bold text-green-600"><CurrencyDisplay amount={selectedUser.referralEarnings || '0'} /></p>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-500">Avg. Per Referral</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {selectedUser.referralCount && Number(selectedUser.referralEarnings) ?
                            formatCurrency(Number(selectedUser.referralEarnings) / selectedUser.referralCount) :
                            formatCurrency(0)
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Detailed information */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 bg-gray-50/50 rounded-lg">
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">ID</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedUser.id}</p>
                      <p className="text-xs text-gray-500">User Identifier</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">@</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedUser.username}</p>
                      <p className="text-xs text-gray-500">Username</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">RC</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedUser.referralCode || 'N/A'}</p>
                      <p className="text-xs text-gray-500">Referral Code</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">BY</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedUser.referredBy || 'N/A'}</p>
                      <p className="text-xs text-gray-500">Referred By</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">DT</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedUser.createdAt ? formatDate(selectedUser.createdAt) : 'N/A'}</p>
                      <p className="text-xs text-gray-500">Registration Date</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary/10 p-1.5 rounded mr-2">
                      <span className="text-primary font-semibold text-xs">ST</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold flex items-center">
                        {selectedUser.referralPending ? (
                          <span className="flex items-center text-amber-500">Pending<span className="ml-1 h-2 w-2 rounded-full bg-amber-500"></span></span>
                        ) : (selectedUser.referralCount || 0) > 0 ? (
                          <span className="flex items-center text-green-600">Completed<span className="ml-1 h-2 w-2 rounded-full bg-green-600"></span></span>
                        ) : (
                          <span className="flex items-center text-gray-500">None<span className="ml-1 h-2 w-2 rounded-full bg-gray-400"></span></span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">Current Status</p>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex justify-between items-center gap-4 sm:gap-0">
                <div className="text-xs text-gray-500">Last Updated: {formatDate(new Date())}</div>
                <Button onClick={() => setViewDetailsOpen(false)} className="gap-2">
                  <span>Close</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* View Stats Dialog */}
          <Dialog open={viewStatsOpen} onOpenChange={setViewStatsOpen}>
            <DialogContent className="sm:max-w-[650px]">
              <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                  <div className="bg-blue-600 p-1.5 rounded-md mr-3">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  Referral Performance Statistics
                </DialogTitle>
                <DialogDescription className="text-base">
                  Performance analytics for {selectedUser.name || selectedUser.username}'s referral activity.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {/* Summary cards with modern design */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 shadow-sm border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-indigo-900">{selectedUser.referralCount || 0}</div>
                      <div className="bg-indigo-100 p-2 rounded-full">
                        <UserPlus className="h-4 w-4 text-indigo-600" />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-indigo-500 mt-1">Total Referrals</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-sm border border-green-100">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-green-900">{formatCurrency(selectedUser.referralEarnings || '0')}</div>
                      <div className="bg-green-100 p-2 rounded-full">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-green-500 mt-1">Total Earnings</div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-4 shadow-sm border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="text-lg font-semibold text-blue-900">
                        {(selectedUser.referralCount || 0) > 0 
                          ? formatCurrency((parseFloat(selectedUser.referralEarnings || '0') / (selectedUser.referralCount || 1)))
                          : formatCurrency(0)}
                      </div>
                      <div className="bg-blue-100 p-2 rounded-full">
                        <ArrowUpRight className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-blue-500 mt-1">Per Referral</div>
                  </div>
                </div>
                
                {/* Referral conversion chart with animated progress bars */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
                  <h3 className="text-base font-semibold mb-4 text-gray-800 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                    Referral Conversion Metrics
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Total Referred Users</span>
                        <span className="font-semibold text-blue-600">{selectedUser.referralCount || 0}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min((selectedUser.referralCount || 0) * 10, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Pending Referrals</span>
                        <span className="font-semibold text-amber-500">{selectedUser.referralPending ? '1' : '0'}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full"
                          style={{ width: `${selectedUser.referralPending ? 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">Conversion Rate</span>
                        <span className="font-semibold text-green-600">
                          {(selectedUser.referralCount || 0) > 0 ? 
                            (((selectedUser.referralCount || 0) / ((selectedUser.referralCount || 0) + (selectedUser.referralPending ? 1 : 0))) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ 
                            width: `${(selectedUser.referralCount || 0) > 0 ? 
                              (((selectedUser.referralCount || 0) / ((selectedUser.referralCount || 0) + (selectedUser.referralPending ? 1 : 0))) * 100) : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Earnings breakdown */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-medium text-gray-600 mb-3">Earnings Breakdown</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <DollarSign className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Referral Bonus</p>
                        <p className="text-xs text-gray-500">Total earnings from referrals</p>
                      </div>
                    </div>
                    <div className="text-lg font-bold text-primary">{formatCurrency(selectedUser.referralEarnings || '0')}</div>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="flex justify-between items-center gap-4 sm:gap-0">
                <div className="text-xs text-gray-500">Updated: {formatDate(new Date())}</div>
                <Button onClick={() => setViewStatsOpen(false)} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <span>Close</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Show Referrals Dialog */}
          <Dialog open={showReferralsOpen} onOpenChange={setShowReferralsOpen}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                  <div className="bg-green-600 p-1.5 rounded-md mr-3">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  Referred Users
                </DialogTitle>
                <DialogDescription className="text-base">
                  Users referred by {selectedUser.name || selectedUser.username}
                  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
                    {selectedUser.referredUsers?.length || 0} total
                  </Badge>
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {selectedUser.referredUsers && selectedUser.referredUsers.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-sm border border-green-100">
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold text-green-900">{selectedUser.referredUsers.length}</div>
                          <div className="bg-green-100 p-2 rounded-full">
                            <Users className="h-4 w-4 text-green-600" />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-green-500 mt-1">Total Referred Users</div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 shadow-sm border border-amber-100">
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold text-amber-900">
                            {selectedUser.referredUsers.filter(user => user.referralPending).length}
                          </div>
                          <div className="bg-amber-100 p-2 rounded-full">
                            <Users className="h-4 w-4 text-amber-600" />
                          </div>
                        </div>
                        <div className="text-xs font-medium text-amber-500 mt-1">Pending Referrals</div>
                      </div>
                    </div>
                    
                    {/* Users Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-700">Referred Users List</h3>
                      </div>
                      
                      <div className="divide-y divide-gray-100">
                        {selectedUser.referredUsers.map((referredUser) => (
                          <div key={referredUser.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Avatar className="h-10 w-10 mr-3 border-2 border-white shadow-sm">
                                  <AvatarFallback className={`${referredUser.referralPending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`} name={referredUser.name || referredUser.username} />
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium flex items-center">
                                    {referredUser.name || referredUser.username}
                                    {referredUser.referralPending ? (
                                      <Badge variant="pending" className="ml-2 text-xs">Pending</Badge>
                                    ) : (
                                      <Badge variant="success" className="ml-2 text-xs">Active</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500">{referredUser.email || `ID: ${referredUser.id}`}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Joined</p>
                                <p className="text-sm font-medium">
                                  {referredUser.createdAt ? formatDate(referredUser.createdAt) : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 px-6 bg-gray-50 rounded-xl">
                    <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
                      <UserPlus className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-800">No Referred Users</h3>
                    <p className="text-gray-500 mt-2 max-w-md mx-auto">
                      This user hasn't referred anyone yet. Referrals will appear here once they start inviting others to the platform.
                    </p>
                    <Button 
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowReferralsOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
              
              {selectedUser.referredUsers && selectedUser.referredUsers.length > 0 && (
                <DialogFooter className="flex justify-between items-center gap-4 sm:gap-0">
                  <div className="text-xs text-gray-500">Last refreshed: {formatDate(new Date())}</div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowReferralsOpen(false)}
                    >
                      Close
                    </Button>
                    <Button 
                      onClick={() => handleDialogAction(selectedUser, 'export')}
                      className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export List</span>
                    </Button>
                  </div>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>

          {/* Export Data Dialog */}
          <Dialog open={exportDataOpen} onOpenChange={setExportDataOpen}>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle className="flex items-center text-xl">
                  <div className="bg-purple-600 p-1.5 rounded-md mr-3">
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  Export Referral Data
                </DialogTitle>
                <DialogDescription className="text-base">
                  Download complete referral data report for {selectedUser.name || selectedUser.username}.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4">
                {/* Company branding */}
                <div className="flex items-center justify-center mb-6 py-3 px-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-800">BILLAYE</div>
                  <div className="text-xs text-gray-500 ml-2 mt-1">Financial Services Platform</div>
                </div>
                
                {/* User card */}
                <div className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-100 mb-4">
                  <Avatar className="h-12 w-12 mr-4 border-2 border-white shadow-sm">
                    <AvatarFallback className="text-lg font-medium text-primary bg-primary/10" name={selectedUser.name || selectedUser.username} />
                  </Avatar>
                  <div>
                    <h3 className="text-base font-medium">{selectedUser.name || selectedUser.username}</h3>
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="mr-2">{selectedUser.email || `ID: ${selectedUser.id}`}</span>
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-500 mr-1"></span>
                      <span className="text-xs text-green-600 font-medium">Active</span>
                    </p>
                  </div>
                </div>
                
                {/* Export content */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-6">
                  <h3 className="text-base font-medium mb-4 text-gray-800 border-b pb-2">Data Export Details</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <DollarSign className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Referral Transaction History</p>
                        <p className="text-xs text-gray-500">Complete transaction records with amounts and status</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Referred Users List</p>
                        <p className="text-xs text-gray-500">Full details of all referred users including status and join date</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center mr-3 flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Performance Analytics</p>
                        <p className="text-xs text-gray-500">Conversion rates, earnings metrics and performance statistics</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Format selection */}
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-3 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-gray-500" />
                    Select Export Format
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div 
                      className="border border-gray-200 hover:border-primary rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-primary/5"
                      onClick={() => handleExport('csv')}
                    >
                      <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                        <Download className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-sm font-medium">CSV Format</p>
                      <p className="text-xs text-gray-500 text-center mt-1">Simple spreadsheet</p>
                    </div>
                    
                    <div 
                      className="border border-gray-200 hover:border-primary rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-primary/5"
                      onClick={() => handleExport('excel')}
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-sm font-medium">Excel Format</p>
                      <p className="text-xs text-gray-500 text-center mt-1">For MS Excel</p>
                    </div>
                    
                    <div 
                      className="border border-gray-200 hover:border-primary rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-primary/5"
                      onClick={() => handleExport('pdf')}
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <p className="text-sm font-medium">PDF Format</p>
                      <p className="text-xs text-gray-500 text-center mt-1">Professional report</p>
                    </div>
                  </div>
                </div>
                
                {/* Disclaimer */}
                <div className="text-xs text-gray-500 mt-2 bg-gray-50 p-3 rounded-lg">
                  <p className="flex items-center">
                    <Info className="h-3 w-3 mr-1 inline" />
                    Data will be exported with Billaye branding and contact information. Files are formatted for printing and sharing.
                  </p>
                </div>
              </div>
              
              <DialogFooter className="flex justify-between items-center gap-4 sm:gap-0">
                <div className="text-xs text-gray-500">Generated by Billaye</div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setExportDataOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={() => handleExport('pdf')} 
                    className="gap-2 bg-purple-600 hover:bg-purple-700"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Report</span>
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
