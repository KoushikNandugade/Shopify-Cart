import { useState } from 'react';

export default function Field({ label, name, type = 'text', error, ...props }) {
  const [visible, setVisible] = useState(false);
  return <div className="field"><label htmlFor={name}>{label}</label><div className="input-wrap"><input id={name} name={name} type={type === 'password' && visible ? 'text' : type} aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} {...props} />{type === 'password' && <button className="password-toggle" type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>}</div>{error && <span className="field-error" id={`${name}-error`}>{error}</span>}</div>;
}
