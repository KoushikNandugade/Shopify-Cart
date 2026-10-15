import Field from './Field.jsx';

export const addressFields = [
  ['fullName', 'Full name', 'name', 'Aarav Sharma'],
  ['phone', 'Phone number', 'tel', '9876543210'],
  ['addressLine1', 'Address line', 'street-address', '22 MG Road'],
  ['city', 'City', 'address-level2', 'Bengaluru'],
  ['state', 'State', 'address-level1', 'Karnataka'],
  ['pincode', 'Pincode', 'postal-code', '560001'],
];
export function validateShipping(form) {
  const errors = {};
  for (const [name, label] of addressFields) {
    if (!form[name].trim()) errors[name] = `${label} is required.`;
    else if (form[name].length > 200) errors[name] = 'Use at most 200 characters.';
  }
  if (form.phone.trim() && !/^\+?[1-9]\d{9,14}$/.test(form.phone.trim())) errors.phone = 'Enter 10–15 digits, with an optional leading +.';
  if (form.pincode.trim() && !/^[1-9]\d{5}$/.test(form.pincode.trim())) errors.pincode = 'Pincode must contain 6 digits and start with 1–9.';
  return errors;
}
export default function CheckoutForm({ form, setForm, errors, setErrors, busy }) {
  return <section className="shipping-form"><span className="section-label">01 / A PLACE FOR YOUR GOOD FINDS</span><h2>Shipping Details</h2><p className="form-intro">Where should we send your order?</p><div className="shipping-fields">{addressFields.map(([name, label, autoComplete, placeholder]) => <Field key={name} name={name} label={label} autoComplete={autoComplete} type={name === 'phone' ? 'tel' : 'text'} inputMode={name === 'pincode' ? 'numeric' : undefined} value={form[name]} onChange={event => { setForm(current => ({ ...current, [name]: event.target.value })); setErrors(current => ({ ...current, [name]: '' })); }} error={errors[name]} placeholder={placeholder} disabled={busy} required />)}</div></section>;
}
