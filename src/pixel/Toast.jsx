import { useEffect, useState } from 'react';
import { subscribeToast } from '../lib/toast.js';

export default function ToastHost() {
  const [msg, setMsg] = useState('');

  useEffect(() => subscribeToast(setMsg), []);

  useEffect(() => {
    if (!msg) return undefined;
    const t = setTimeout(() => setMsg(''), 2200);
    return () => clearTimeout(t);
  }, [msg]);

  return msg ? <div className="toast">{msg}</div> : null;
}
