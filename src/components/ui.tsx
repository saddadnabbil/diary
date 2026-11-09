import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode } from "react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const pill = "inline-flex items-center justify-center rounded-full text-[14px] leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-50 disabled:pointer-events-none";
const variants = {
  primary: "bg-primary text-on-primary font-medium px-[18px] py-2.5 hover:opacity-90",
  secondary: "bg-bg text-fg-2 border border-line px-[18px] py-2.5 hover:bg-surface-hover",
  ghost: "text-fg-2 px-3 py-2 hover:text-fg",
};
type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cx(pill, variants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(pill, variants[variant], className)} {...props} />;
}

export function Chip({
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] leading-[18px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        selected ? "bg-primary text-on-primary border-primary font-medium" : "bg-bg text-fg-2 border-line hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  id,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] leading-[18px] font-medium text-fg-2">
        {label}
      </label>
      <input
        id={id}
        className={cx(
          "w-full rounded-[14px] border border-line bg-bg px-4 py-3.5 text-[16px] leading-6 text-fg placeholder:text-fg-3 focus:border-fg focus:outline-none",
          className,
        )}
        {...props}
      />
      {hint && <p className="text-[13px] leading-[18px] text-fg-3">{hint}</p>}
    </div>
  );
}

export function OptionCard({
  selected,
  title,
  description,
  tag,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  tag?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "w-full text-left rounded-[20px] bg-bg p-5 flex flex-col gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        selected ? "border-[1.5px] border-fg" : "border border-line hover:bg-surface",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="text-[17px] leading-6 font-medium">{title}</span>
        {tag && <span className="rounded-full border border-line px-2.5 py-0.5 text-[12px] leading-4 text-fg-2">{tag}</span>}
        <span
          className={cx(
            "ml-auto size-[18px] shrink-0 rounded-full",
            selected ? "bg-primary" : "border-[1.5px] border-line",
          )}
        />
      </span>
      <span className="text-[15px] leading-[22px] text-fg-2">{description}</span>
    </button>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="display text-[28px] md:text-[44px] md:leading-[48px]">{children}</h1>
      {sub && <p className="text-[17px] md:text-[18px] leading-7 text-fg-2">{sub}</p>}
    </header>
  );
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={cx("inline-block size-2 rounded-full bg-success", className)} aria-hidden="true" />;
}
