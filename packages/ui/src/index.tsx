import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#6C4CF1]/50 disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variants = {
      primary: "bg-[#6C4CF1] hover:bg-[#5B3DE0] text-white shadow-md shadow-[#6C4CF1]/20",
      secondary: "bg-[#F5F2FF] hover:bg-[#E8E0FF] text-[#6C4CF1] border border-[#E8E0FF]",
      danger: "bg-[#C53D52] hover:bg-red-700 text-white shadow-md shadow-red-500/20",
      outline: "bg-transparent border border-[#E7E2EB] text-[#17131D] hover:bg-[#F5F2FF] hover:border-[#6C4CF1]",
      ghost: "bg-transparent text-[#6E6875] hover:text-[#17131D] hover:bg-[#F5F2FF]",
    };

    const sizes = {
      sm: "px-3.5 py-1.5 text-xs",
      md: "px-5 py-2.5 text-sm",
      lg: "px-7 py-3.5 text-base",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// Card Component
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "white" | "lavender" | "plum" | "bordered";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "white", children, ...props }, ref) => {
    const variants = {
      white: "bg-white border border-[#E7E2EB] shadow-sm",
      lavender: "bg-[#F5F2FF] border border-[#E8E0FF]",
      plum: "bg-[#21182F] text-white border border-white/10 shadow-xl",
      bordered: "bg-white border-2 border-[#E7E2EB]",
    };

    return (
      <div
        ref={ref}
        className={cn("rounded-3xl p-6 transition-all", variants[variant], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

// Badge Component
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "purple" | "success" | "warning" | "danger" | "neutral";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "purple",
  children,
  ...props
}) => {
  const variants = {
    purple: "bg-[#F5F2FF] text-[#6C4CF1] border border-[#E8E0FF]",
    success: "bg-emerald-50 text-[#238A5A] border border-emerald-200",
    warning: "bg-amber-50 text-[#B87512] border border-amber-200",
    danger: "bg-rose-50 text-[#C53D52] border border-rose-200",
    neutral: "bg-gray-100 text-[#6E6875] border border-gray-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

// Stepper Component for 7-Step Onboarding
export interface StepperProps {
  totalSteps: number;
  currentStep: number; // 1-indexed
  onStepClick?: (step: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ totalSteps, currentStep, onStepClick }) => {
  return (
    <div className="w-full flex items-center justify-between gap-2">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div
            key={step}
            onClick={() => isCompleted && onStepClick?.(step)}
            className={cn(
              "flex-1 h-2 rounded-full transition-all duration-300",
              isCompleted
                ? "bg-[#6C4CF1] cursor-pointer"
                : isActive
                ? "bg-[#6C4CF1] ring-4 ring-[#F5F2FF]"
                : "bg-[#E7E2EB]"
            )}
            title={`Step ${step}`}
          />
        );
      })}
    </div>
  );
};
