import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ordersApi } from '../services/api.js';

export default function useOrders(path = '') {
  const [state, setState] = useState({ loading: true, data: null, error: '', status: 0 });
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, data: null, error: '', status: 0 });
    ordersApi(path, { signal: controller.signal }).then(data => setState({ loading: false, data, error: '', status: 200 })).catch(error => {
      if (error.name === 'AbortError') return;
      if (error.status === 401) navigate('/login', { replace: true, state: { returnTo: pathname } });
      else setState({ loading: false, data: null, error: error.message, status: error.status });
    });
    return () => controller.abort();
  }, [path, attempt, navigate, pathname]);
  return { ...state, retry: () => setAttempt(value => value + 1) };
}
