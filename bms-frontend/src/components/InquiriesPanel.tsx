import { useState } from "react";
import { Mail, MessageSquareText, Phone } from "lucide-react";

export type CustomerInquiry = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  source: string;
  assigned_to_name: string;
  created_at: string;
};

type Props = {
  inquiries: CustomerInquiry[];
  disabled: boolean;
  onUpdateStatus: (id: number, status: CustomerInquiry["status"]) => Promise<boolean>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function InquiriesPanel({ inquiries, disabled, onUpdateStatus }: Props) {
  const [filter, setFilter] = useState<CustomerInquiry["status"] | "all">("all");
  const visibleInquiries = filter === "all" ? inquiries : inquiries.filter((item) => item.status === filter);

  return (
    <div className="stacked-panels">
      <section className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Messages from the public website</p><h2>Customer inquiries</h2></div>
          <label className="period-select">Show
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="all">All messages</option>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
        </div>
        {visibleInquiries.length ? (
          <div className="inquiry-list">
            {visibleInquiries.map((item) => (
              <article className="inquiry-row" key={item.id}>
                <div className="inquiry-main">
                  <div className="inquiry-title">
                    <div><h3>{item.subject || "Website message"}</h3><span>{item.name} · {formatDate(item.created_at)}</span></div>
                    <span className={`status-pill${item.status === "resolved" ? " status-ready" : item.status === "new" ? " status-pending" : ""}`}>{item.status.replace("_", " ")}</span>
                  </div>
                  <p>{item.message}</p>
                  <div className="inquiry-contact">
                    <a href={`mailto:${item.email}`}><Mail size={14} />{item.email}</a>
                    {item.phone && <a href={`tel:${item.phone}`}><Phone size={14} />{item.phone}</a>}
                  </div>
                </div>
                <label className="inquiry-status">Status
                  <select
                    value={item.status}
                    disabled={disabled}
                    onChange={(event) => onUpdateStatus(item.id, event.target.value as CustomerInquiry["status"])}
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon"><MessageSquareText size={22} /></span>
            <h3>{inquiries.length ? "No messages in this filter" : "No inquiries yet"}</h3>
            <p>Messages sent from the public website will appear here for the team to follow up.</p>
          </div>
        )}
      </section>
    </div>
  );
}
