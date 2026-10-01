"use client";

import { useId } from "react";

import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Input,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import NiChevronDownSmall from "@/icons/nexture/ni-chevron-down-small";
import type { Localized } from "@/lib/admin/catalog";

/**
 * The catalog console's form fields, in the admin's own idiom (an outlined
 * FormControl with a FormLabel tied to its control by a generated id, as in
 * billing/components/catalog-shared.tsx). They exist because the catalog
 * writes texts in two languages and Markdown, which the shared admin fields
 * do not cover.
 */

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  help,
  disabled,
  placeholder,
  multiline,
  rows,
  className,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <FormControl className={`outlined ${className ?? ""}`} variant="standard" size="small" fullWidth>
      <FormLabel component="label" htmlFor={id}>
        {label}
      </FormLabel>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        multiline={multiline}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        inputProps={help ? { "aria-describedby": `${id}-help` } : undefined}
      />
      {help ? (
        <Typography id={`${id}-help`} variant="body2" className="text-text-secondary mt-1">
          {help}
        </Typography>
      ) : null}
    </FormControl>
  );
}

/** The same text in Portuguese and English, side by side on a wide screen. */
export function LocalizedInput({
  label,
  value,
  onChange,
  required,
  multiline,
  rows,
  help,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  /** The Portuguese text is required (the database refuses a module without it). */
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  help?: string;
}) {
  return (
    <Box className="flex flex-col gap-1">
      <Box className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextInput
          label={`${label} em português${required ? " (obrigatório)" : ""}`}
          value={value["pt-BR"] ?? ""}
          onChange={(text) => onChange({ ...value, "pt-BR": text })}
          multiline={multiline}
          rows={rows}
        />
        <TextInput
          label={`${label} em inglês`}
          value={value.en ?? ""}
          onChange={(text) => onChange({ ...value, en: text })}
          multiline={multiline}
          rows={rows}
        />
      </Box>
      {help ? (
        <Typography variant="body2" className="text-text-secondary">
          {help}
        </Typography>
      ) : null}
    </Box>
  );
}

export function SelectInput({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FormControl className="outlined" variant="standard" size="small" fullWidth>
      <FormLabel component="label" id={`${id}-label`} htmlFor={id}>
        {label}
      </FormLabel>
      <Select
        id={id}
        labelId={`${id}-label`}
        value={value}
        size="small"
        variant="standard"
        disabled={disabled}
        IconComponent={NiChevronDownSmall}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function CheckInput({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <Box className="flex flex-col">
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />}
        label={label}
      />
      {help ? (
        <Typography variant="body2" className="text-text-secondary ml-8">
          {help}
        </Typography>
      ) : null}
    </Box>
  );
}

/** A set of options where any number may be on, as a labelled group of checkboxes. */
export function CheckGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  return (
    <Box role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <Typography id={id} variant="body2" component="span" className="text-text-secondary">
        {label}
      </Typography>
      <Box className="flex flex-row flex-wrap gap-x-4">
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            label={option.label}
            control={
              <Checkbox
                checked={value.includes(option.value)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...value, option.value] : value.filter((entry) => entry !== option.value),
                  )
                }
              />
            }
          />
        ))}
      </Box>
    </Box>
  );
}
