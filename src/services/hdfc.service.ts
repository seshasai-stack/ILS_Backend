import axios, {
  type AxiosRequestConfig,
} from "axios";

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

const baseUrl = getRequiredEnv("HDFC_BASE_URL")
  .replace(/\/+$/, "");

const apiKey = getRequiredEnv("HDFC_API_KEY");

const merchantId = getRequiredEnv(
  "HDFC_MERCHANT_ID"
);

const paymentPageClientId = getRequiredEnv(
  "HDFC_PAYMENT_PAGE_CLIENT_ID"
);

const responseKey = getRequiredEnv(
  "HDFC_RESPONSE_KEY"
);

export interface CreateSessionPayload {
  order_id: string;
  amount: string;
  currency: "INR";

  customer_id: string;
  customer_first_name: string;
  customer_email: string;
  customer_phone: string;

  return_url: string;
  description: string;

  payment_page_client_id?: string;
}

export interface HdfcOrderResponse {
  id?: string;
  order_id?: string;
  customer_id?: string;
  customer_email?: string;
  customer_phone?: string;

  amount?: number;
  currency?: string;

  status?: string;
  status_id?: number;

  txn_id?: string;
  payment_method_type?: string;

  payment_links?: {
    web?: string;
    iframe?: string;
    mobile?: string;
  };

  [key: string]: unknown;
}

function getRequestConfig(): AxiosRequestConfig {
  return {
    auth: {
      username: apiKey,
      password: "",
    },

    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-merchantid": merchantId,
    },

    timeout: 30_000,
  };
}

export async function createHdfcSession(
  payload: CreateSessionPayload
): Promise<HdfcOrderResponse> {
  const response =
    await axios.post<HdfcOrderResponse>(
      `${baseUrl}/session`,
      {
        ...payload,
        payment_page_client_id:
          paymentPageClientId,
      },
      getRequestConfig()
    );

  return response.data;
}

export async function getHdfcOrderStatus(
  orderId: string
): Promise<HdfcOrderResponse> {
  const response =
    await axios.get<HdfcOrderResponse>(
      `${baseUrl}/orders/${encodeURIComponent(
        orderId
      )}`,
      getRequestConfig()
    );

  return response.data;
}

export function getHdfcResponseKey(): string {
  return responseKey;
}