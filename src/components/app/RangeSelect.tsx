import { RANGE_OPTIONS, type RangeKey } from "@/lib/series";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The date-range selector used by dashboard and payment revenue views.
 *
 * The range drives live revenue. User and property counts beside it are all-time
 * totals that no range can narrow — nothing in
 * `GET /admin/users` accepts a date window. The screens say which cards the range
 * applies to rather than implying it filters everything.
 */
export function RangeSelect({
  value,
  onChange,
  className,
}: {
  value: RangeKey;
  onChange: (value: RangeKey) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as RangeKey)}>
      <SelectTrigger className={className} aria-label="Date range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
