"use client";

const statusOptions = [
  { value: "", label: "全部" },
  { value: "PENDING_ENQUEUE", label: "入队" },
  { value: "QUEUED", label: "排队" },
  { value: "RUNNING", label: "生成中" },
  { value: "COMPLETED", label: "完成" },
  { value: "FAILED", label: "失败" }
];

export function AdminStatusFilters({ status, onChange }: { status: string; onChange: (status: string) => void }) {
  return (
    <div className="filter-pills">
      {statusOptions.map((option) => (
        <button className={status === option.value ? "filter-pill active" : "filter-pill"} key={option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
