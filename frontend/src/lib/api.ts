import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

/**
 * Monetary fields are serialized as strings by the Go backend because
 * they use decimal.Decimal (which avoids float rounding errors). The
 * front-end code, however, calls .toFixed() and Math.min() on these,
 * so we coerce a known list of money/quantity fields to numbers on the
 * way in. Unknown fields are left alone.
 */
const NUMERIC_FIELDS = new Set([
  'price',
  'unit_price',
  'subtotal',
  'total',
  'total_amount',
  'total_price',
  'shipping_fee',
	'shipping_base_amount',
	'shipping_subsidy_amount',
	'shipping_remote_surcharge',
	'shipping_payable_amount',
	'raw_base_amount',
	'rounded_base_amount',
	'rounding_unit',
	'subsidy_amount',
	'remote_surcharge',
	'payable_shipping',
  'discount_amount',
  'received_amount',
	'declared_amount',
	'allocated_amount',
	'verified_total',
	'allocated_total',
	'pending_allocation',
	'overpaid_amount',
  'refund_amount',
  'revenue',
  'avg_order_value',
  'percentage',
  'conversion_rate',
]);

function coerceNumerics(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = coerceNumerics(value[i]);
    return value;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === 'string' && NUMERIC_FIELDS.has(key)) {
        const n = Number(v);
        if (!Number.isNaN(n)) obj[key] = n;
      } else {
        obj[key] = coerceNumerics(v);
      }
    }
    return obj;
  }
  return value;
}

/**
 * Axios API client configured for the digital store backend.
 * Base URL is read from NEXT_PUBLIC_API_BASE_URL environment variable.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
	withCredentials: true,
});

// Request interceptor: attach auth token if available
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: coerce decimal-string fields to numbers, handle 401.
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) coerceNumerics(response.data);
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear stored token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
