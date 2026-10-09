import { PlaceOrderRequest, type Money } from '@ite/contracts';

/*
 * The checkout form's fields and state (guest-checkout design D7). Pure, so the Server Action and
 * the form component share it, and it is unit-tested. Entered values travel only in the action's
 * state, never in a URL: they are personal data.
 */

export const FIELDS = [
  'email',
  'name',
  'phone',
  'line1',
  'line2',
  'city',
  'province',
  'postalCode',
  'note',
] as const;
export type Field = (typeof FIELDS)[number];
export type FormValues = Partial<Record<Field, string>>;

export type CheckoutFormState =
  | { status: 'idle' }
  /** Details to fix: one message per field, with what was entered. */
  | { status: 'invalid'; errors: Partial<Record<Field, string>>; values: FormValues }
  /** The cart, prices, or stock changed since the page was shown. */
  | { status: 'changed'; values: FormValues }
  /** The order could not be placed right now. */
  | { status: 'failed'; values: FormValues };

export const INITIAL_STATE: CheckoutFormState = { status: 'idle' };

/** A request path (`email`, `address.postalCode`, `body.address.city`) → its form field. */
const PATH_TO_FIELD: Record<string, Field> = {
  email: 'email',
  name: 'name',
  phone: 'phone',
  'address.line1': 'line1',
  'address.line2': 'line2',
  'address.city': 'city',
  'address.province': 'province',
  'address.postalCode': 'postalCode',
  note: 'note',
};

export function fieldOf(path: string): Field | undefined {
  return PATH_TO_FIELD[path.replace(/^body\./, '')];
}

/** The submitted values (strings only; files and unknown fields ignored). */
export function readValues(formData: FormData): FormValues {
  const values: FormValues = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    if (typeof value === 'string') values[field] = value;
  }
  return values;
}

/** The order request for the submitted values, or the field errors (first message per field). */
export function toRequest(
  values: FormValues,
  expectedTotal: Money,
):
  { ok: true; request: PlaceOrderRequest } | { ok: false; errors: Partial<Record<Field, string>> } {
  const parsed = PlaceOrderRequest.safeParse({
    email: values.email ?? '',
    name: values.name ?? '',
    phone: values.phone ?? '',
    address: {
      line1: values.line1 ?? '',
      line2: values.line2 ?? '',
      city: values.city ?? '',
      province: values.province ?? '',
      postalCode: values.postalCode ?? '',
    },
    note: values.note ?? '',
    expectedTotal,
  });
  if (parsed.success) return { ok: true, request: parsed.data };
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = fieldOf(issue.path.join('.'));
    if (field && !errors[field]) errors[field] = messageFor(field, issue.message);
  }
  return { ok: false, errors };
}

/** Customer-facing wording for each field's problem. */
function messageFor(field: Field, message: string): string {
  switch (field) {
    case 'email':
      return 'Enter a valid email address.';
    case 'phone':
      return 'Enter an Indonesian mobile number, e.g. 0812 3456 7890.';
    case 'province':
      return 'Choose a province.';
    case 'postalCode':
      return 'Enter a 5-digit postal code.';
    case 'name':
      return 'Enter the recipient’s name (up to 100 characters).';
    case 'line1':
      return 'Enter the street address (up to 200 characters).';
    case 'city':
      return 'Enter the city or regency (up to 100 characters).';
    default:
      return message.endsWith('.') ? message : `${message}.`;
  }
}
