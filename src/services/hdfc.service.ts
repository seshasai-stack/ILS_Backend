import axios, {
  type AxiosRequestConfig,
} from "axios";

const baseUrl = process.env.HDFC_BASE_URL;
const apiKey = process.env.HDFC_API_KEY;
const merchantId = process.env.HDFC_MERCHANT_ID;
const paymentPageClientId =
  process.env.HDFC_PAYMENT_PAGE_CLIENT_ID;

if (
  !baseUrl ||
  !apiKey ||
  !merchantId ||
  !paymentPageClientId
) {
  throw new Error(
    "HDFC SmartGateway configuration is incomplete"
  );
}

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
  const response = await axios.post<HdfcOrderResponse>(
    `${baseUrl.replace(/\/$/, "")}/session`,
    {
      ...payload,
      payment_page_client_id: paymentPageClientId,
    },
    getRequestConfig()
  );

  return response.data;
}

export async function getHdfcOrderStatus(
  orderId: string
): Promise<HdfcOrderResponse> {
  const response = await axios.get<HdfcOrderResponse>(
    `${baseUrl.replace(/\/$/, "")}/orders/${encodeURIComponent(
      orderId
    )}`,
    getRequestConfig()
  );

  return response.data;
}