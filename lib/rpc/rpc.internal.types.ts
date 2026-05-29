type JsonObj = Record<string, unknown>;

type RpcEnvelope = {
  jsonrpc?: string;
  id?: string | number;
  result?: JsonObj;
  error?: {
    code?: number;
    message?: string;
  };
};
