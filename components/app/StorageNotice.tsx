export function StorageNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "storage-notice compact" : "storage-notice"}>
      <strong>请及时下载保存图片。</strong>
      <span>服务器存储空间有限，历史图片、参考图和缩略图可能会被管理员定期或临时清理；清理后站内将无法继续预览或下载。</span>
    </div>
  );
}
