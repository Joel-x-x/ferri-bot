export interface FieldError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

export interface PageMeta {
  currentPage: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  status: number;
  timestamp: string;
  path: string;
  data?: T;
  message?: string;
  errorCode?: string;
  errors?: string[] | FieldError[];
  page?: PageMeta;
}
