import { Link } from '@/i18n/navigation';
import { StatusBadge } from '@/components/admin/ui';
import { Clock } from 'lucide-react';

/**
 * Dashboard "Recent orders" table (V5 audit D-04): extracted so the semantic
 * header row (`<thead>` + `scope="col"`) is unit-testable. Presentational —
 * rows arrive pre-formatted (money/date as strings, no BigInt/Date).
 * Wrapped in its own horizontal scroller so a narrow viewport can never make
 * the table expand the page (V5 audit D-02).
 */
export type RecentOrderRow = {
  id: string;
  number: string;
  customer: string;
  total: string;
  status: string;
  date: string;
};

export type RecentOrdersLabels = {
  order: string;
  customer: string;
  total: string;
  status: string;
  date: string;
};

export function RecentOrdersTable({ rows, labels }: { rows: RecentOrderRow[]; labels: RecentOrdersLabels }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted-foreground">
            <th scope="col" className="pb-2 text-start font-medium">{labels.order}</th>
            <th scope="col" className="pb-2 text-start font-medium">{labels.customer}</th>
            <th scope="col" className="pb-2 text-start font-medium">{labels.total}</th>
            <th scope="col" className="pb-2 text-start font-medium">{labels.status}</th>
            <th scope="col" className="pb-2 text-end font-medium">{labels.date}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-border">
              <td className="py-2.5">
                <Link href={`/admin/orders/${o.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                  {o.number}
                </Link>
              </td>
              <td className="py-2.5 text-muted-foreground">{o.customer}</td>
              <td className="py-2.5 text-foreground">{o.total}</td>
              <td className="py-2.5"><StatusBadge status={o.status} /></td>
              <td className="py-2.5 text-end text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock size={12} /> {o.date}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
