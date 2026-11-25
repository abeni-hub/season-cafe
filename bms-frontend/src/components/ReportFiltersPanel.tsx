export type ReportFilters = {
  product: string;
  payment_method: string;
  employee: string;
  start_date: string;
  end_date: string;
};

export type ReportEmployee = {
  id: number;
  display_name: string;
  role: string;
  location_name: string;
};

type Props = {
  products: Array<{ id: number; name: string }>;
  employees: ReportEmployee[];
  filters: ReportFilters;
  startDate: string;
  endDate: string;
  onChange: (filters: ReportFilters) => void;
};

export function ReportFiltersPanel({
  products,
  employees,
  filters,
  startDate,
  endDate,
  onChange,
}: Props) {
  return (
    <section className="panel report-filter-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Narrow the records</p><h2>Report filters</h2></div>
        <span>{startDate} to {endDate}</span>
      </div>
      <div className="report-filters">
        <label>Start date<input type="date" value={filters.start_date} onChange={(event) => onChange({ ...filters, start_date: event.target.value })} /></label>
        <label>End date<input type="date" value={filters.end_date} onChange={(event) => onChange({ ...filters, end_date: event.target.value })} /></label>
        <label>Cake<select value={filters.product} onChange={(event) => onChange({ ...filters, product: event.target.value })}><option value="">All cakes</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
        <label>Payment method<select value={filters.payment_method} onChange={(event) => onChange({ ...filters, payment_method: event.target.value })}><option value="">All methods</option><option value="cash">Cash</option><option value="telebirr">Telebirr</option><option value="bank_transfer">Bank transfer</option></select></label>
        <label>Team member<select value={filters.employee} onChange={(event) => onChange({ ...filters, employee: event.target.value })}><option value="">All team members</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.display_name} · {employee.location_name || employee.role}</option>)}</select></label>
      </div>
      <p className="form-hint">Choose both dates to use a custom range; otherwise the period above applies. Payment method filters collections and refunds.</p>
    </section>
  );
}
