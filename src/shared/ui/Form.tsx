import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

interface FieldShellProps {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
}

export interface FieldProps extends FieldShellProps {
  htmlFor: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, helperText, error, children }: FieldProps) {
  const helperId = helperText ? `${htmlFor}-helper` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={error ? 'field field--error' : 'field'}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field__required">必須</span>}
      </label>
      {children}
      {helperText && <span className="field__helper" id={helperId}>{helperText}</span>}
      {error && <span className="field__error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

type TextInputProps = FieldShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'required'>;

export function TextInput({ label, helperText, error, required, id, ...inputProps }: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={inputId} required={required} helperText={helperText} error={error}>
      <input
        {...inputProps}
        id={inputId}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, helperText, error)}
      />
    </Field>
  );
}

type TextareaFieldProps = FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'>;

export function TextareaField({ label, helperText, error, required, id, ...textareaProps }: TextareaFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={inputId} required={required} helperText={helperText} error={error}>
      <textarea
        {...textareaProps}
        id={inputId}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, helperText, error)}
      />
    </Field>
  );
}

type SelectFieldProps = FieldShellProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'>;

export function SelectField({ label, helperText, error, required, id, children, ...selectProps }: SelectFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field label={label} htmlFor={inputId} required={required} helperText={helperText} error={error}>
      <select
        {...selectProps}
        id={inputId}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, helperText, error)}
      >
        {children}
      </select>
    </Field>
  );
}

type CheckboxFieldProps = {
  label: string;
  description?: string;
  error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function CheckboxField({ label, description, error, id, ...inputProps }: CheckboxFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={error ? 'checkbox-field-shell field--error' : 'checkbox-field-shell'}>
      <label className="checkbox-field" htmlFor={inputId}>
        <input
          {...inputProps}
          id={inputId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, description, error)}
        />
        <span className="checkbox-field__content">
          <strong>{label}</strong>
          {description && <span id={`${inputId}-helper`}>{description}</span>}
        </span>
      </label>
      {error && <span className="field__error" id={`${inputId}-error`} role="alert">{error}</span>}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <div className="form-section__header">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="form-section__body">{children}</div>
    </section>
  );
}

export function FormActions({ children, danger }: { children: ReactNode; danger?: ReactNode }) {
  return (
    <div className="form-actions form-actions--grouped">
      <div className="form-actions__main">{children}</div>
      {danger && <div className="form-actions__danger">{danger}</div>}
    </div>
  );
}

function describedBy(id: string, helperText?: string, error?: string): string | undefined {
  const ids = [helperText ? `${id}-helper` : '', error ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
