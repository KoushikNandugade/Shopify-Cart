export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, signal, prefix = '/customers' } = {}) {
  let response;
  try {
    response = await fetch(`${prefix}${path}`, {
      method, credentials: 'include', signal,
      ...(body !== undefined && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Unable to connect. Check your connection and try again.', 0);
  }
  const data = await response.json().catch(error => {
    if (error.name === 'AbortError') throw error;
    return null;
  });
  if (!response.ok) throw new ApiError(data?.message || 'The service is unavailable. Please try again.', response.status);
  if (!data) throw new ApiError('Unexpected response from the service. Please try again.', 502);
  return data;
}

export const productApi = (path = '', options = {}) => api(path, { ...options, prefix: '/api/products' });
export const wishlistApi = (path = '', options = {}) => api(path, { ...options, prefix: '/api/wishlist' });
export const cartApi = (path = '', options = {}) => api(path, { ...options, prefix: '/api/cart' });
export const ordersApi = (path = '', options = {}) => api(path, { ...options, prefix: '/api/orders' });
