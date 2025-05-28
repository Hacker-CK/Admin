import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchIcon, FilterIcon, ChevronLeftIcon, ChevronRightIcon, ArrowDownIcon, ArrowUpIcon } from 'lucide-react';

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    title: string;
    render?: (item: T) => React.ReactNode;
    sortable?: boolean;
  }[];
  onSearch?: (searchTerm: string) => void;
  onFilter?: () => void;
  onRowClick?: (item: T) => void;
  itemsPerPage?: number;
  isLoading?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T>({
  data,
  columns,
  onSearch,
  onFilter,
  onRowClick,
  itemsPerPage = 25,
  isLoading = false
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string | null>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Sort the data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return data;
    
    return [...data].sort((a, b) => {
      // Get values to compare
      const aValue = (a as any)[sortField];
      const bValue = (b as any)[sortField];

      // Handle undefined or null values
      if (aValue === undefined || aValue === null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === undefined || bValue === null) return sortDirection === 'asc' ? 1 : -1;
      
      // Compare by timestamp specifically if it's a date field
      if (sortField === 'timestamp' || (typeof aValue === 'string' && aValue.match(/^\d{4}-\d{2}-\d{2}/))) {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        return sortDirection === 'asc' 
          ? aDate.getTime() - bDate.getTime() 
          : bDate.getTime() - aDate.getTime();
      }

      // Compare strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      // Compare numbers
      return sortDirection === 'asc' 
        ? aValue - bValue 
        : bValue - aValue;
    });
  }, [data, sortField, sortDirection]);
  
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const visibleData = sortedData.slice(startIdx, startIdx + itemsPerPage);
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) {
      onSearch(value);
    }
  };
  
  const handleSort = (key: string) => {
    // Find the column to check if it's sortable
    const column = columns.find(col => col.key === key);
    
    // If the column is not sortable, do nothing
    if (column?.sortable === false) return;
    
    // Toggle sort direction or set new sort field
    if (sortField === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(key);
      setSortDirection('asc');
    }
    
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };
  
  const handlePageClick = (page: number) => {
    setCurrentPage(page);
  };
  
  return (
    <div>
      {(onSearch || onFilter) && (
        <div className="flex items-center justify-between mb-6">
          {onSearch && (
            <div className="relative">
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-64 pl-10 bg-gray-100"
              />
              <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          )}
          {onFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFilter}
              className="border border-gray-200 rounded-md text-sm hover:bg-gray-50"
            >
              <FilterIcon className="mr-1 h-4 w-4" /> Filter
            </Button>
          )}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th 
                  key={column.key} 
                  className={`table-head-cell ${column.sortable !== false ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center justify-between">
                    {column.title}
                    {column.sortable !== false && sortField === column.key && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? (
                          <ArrowUpIcon className="h-4 w-4 text-primary" />
                        ) : sortDirection === 'desc' ? (
                          <ArrowDownIcon className="h-4 w-4 text-primary" />
                        ) : null}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading skeleton
              Array(itemsPerPage).fill(0).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-b border-gray-100">
                  {columns.map((column) => (
                    <td key={`skeleton-${column.key}`} className="table-body-cell">
                      <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              // Actual data rows
              visibleData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="table-body-cell">
                      {column.render ? column.render(row) : (row as any)[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {isLoading ? (
        <div className="mt-4 h-12 bg-gray-100 rounded animate-pulse"></div>
      ) : data.length > 0 ? (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 mt-4">
          <div className="text-sm text-gray-500">
            Showing {startIdx + 1} to {Math.min(startIdx + itemsPerPage, data.length)} of {data.length} entries
          </div>
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 p-0"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            
            {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => {
              let pageNumber = i + 1;
              
              // For many pages, show first, current, and last
              if (totalPages > 3) {
                if (currentPage > 2 && currentPage < totalPages - 1) {
                  pageNumber = i === 0 ? 1 : i === 1 ? currentPage : totalPages;
                } else if (currentPage >= totalPages - 1) {
                  pageNumber = totalPages - 2 + i;
                }
              }
              
              return (
                <Button
                  key={pageNumber}
                  variant={currentPage === pageNumber ? "default" : "outline"}
                  size="icon"
                  className="w-8 h-8 p-0"
                  onClick={() => handlePageClick(pageNumber)}
                >
                  {pageNumber}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="icon"
              className="w-8 h-8 p-0"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-gray-500">No data available</div>
      )}
    </div>
  );
}
