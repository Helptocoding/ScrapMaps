"use client";

import * as React from "react";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MicroLabel } from "@/components/ui/tag";

import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: React.ReactNode;
  searchable?: string;
  disabled?: boolean;
};

type ComboboxProps = {
  label: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  /**
   * `toolbar` → control inline, sin label externo (el label va de placeholder).
   * `stacked` → label micro arriba del control. Para filtros y formularios.
   */
  variant?: "toolbar" | "stacked";
  placeholder?: string;
  className?: string;
};

function nodeToText(node: React.ReactNode | null | undefined): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join(" ").replace(/\s+/g, " ").trim();
  if (React.isValidElement(node)) return nodeToText((node.props as { children?: React.ReactNode })?.children);
  return "";
}

export function Combobox({
  label,
  value,
  options,
  onChange,
  variant = "stacked",
  placeholder,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((option) => option.value === value);

  const searchToValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      map.set(option.searchable ?? nodeToText(option.label), option.value);
    }
    return map;
  }, [options]);

  const trigger = (
    <PopoverTrigger asChild>
      <button
        type="button"
        // Radix inyecta aria-controls/aria-haspopup en el trigger en runtime;
        // el linter solo ve el JSX estático.
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "flex h-7 w-full items-center justify-between gap-1.5 rounded border border-transparent px-2 text-body",
          "transition-colors hover:bg-panel-2 data-[state=open]:border-line-strong data-[state=open]:bg-panel-2",
          selected ? "text-ink" : "text-ink-3",
          className,
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder ?? label}</span>
        <ChevronDownIcon size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
      </button>
    </PopoverTrigger>
  );

  const content = (
    <PopoverContent className="w-[min(280px,var(--radix-popper-anchor-width,280px))] p-0" align="start" sideOffset={4}>
      <Command>
        <CommandInput placeholder="Buscar…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup>
            {options.map((option) => {
              const search = option.searchable ?? nodeToText(option.label);
              return (
                <CommandItem
                  key={option.value}
                  value={search}
                  disabled={option.disabled}
                  className={cn(option.disabled && "cursor-not-allowed opacity-50")}
                  onSelect={(currentValue) => {
                    onChange(searchToValue.get(currentValue) ?? currentValue);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {value === option.value ? (
                    <CheckIcon size={14} className="ml-auto shrink-0 text-accent" />
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  );

  if (variant === "toolbar") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        {trigger}
        {content}
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="grid gap-1">
        <MicroLabel>{label}</MicroLabel>
        {trigger}
      </div>
      {content}
    </Popover>
  );
}
