import { RANGE_OPTIONS, type RangeKey } from "@/lib/demo/dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The date-range selector the design puts in the top right of the dashboard and
 * analytics screens.
 *
 * It is honest about its reach: the ranges drive the demo trend series, and the
 * live counts beside them are all-time totals that no range can narrow — nothing in
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
